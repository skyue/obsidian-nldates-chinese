'use strict';

var obsidian = require('obsidian');

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";
function getApp() {
    return window.app;
}
function shouldUsePeriodicNotesSettings(periodicity) {
    var _a, _b;
    const plugin = getApp().plugins.getPlugin("periodic-notes");
    return Boolean((_b = (_a = plugin === null || plugin === void 0 ? void 0 : plugin.settings) === null || _a === void 0 ? void 0 : _a[periodicity]) === null || _b === void 0 ? void 0 : _b.enabled);
}
function getDailyNoteSettings() {
    var _a, _b;
    try {
        const app = getApp();
        if (shouldUsePeriodicNotesSettings("daily")) {
            const plugin = app.plugins.getPlugin("periodic-notes");
            const daily = ((_a = plugin === null || plugin === void 0 ? void 0 : plugin.settings) === null || _a === void 0 ? void 0 : _a.daily) || {};
            return {
                format: typeof daily.format === "string"
                    ? daily.format
                    : DEFAULT_DAILY_NOTE_FORMAT,
                folder: typeof daily.folder === "string" ? daily.folder.trim() : "",
                template: typeof daily.template === "string" ? daily.template.trim() : "",
            };
        }
        const plugin = app.internalPlugins.getPluginById("daily-notes");
        const options = (_b = plugin === null || plugin === void 0 ? void 0 : plugin.instance) === null || _b === void 0 ? void 0 : _b.options;
        return {
            format: typeof (options === null || options === void 0 ? void 0 : options.format) === "string"
                ? options.format
                : DEFAULT_DAILY_NOTE_FORMAT,
            folder: typeof (options === null || options === void 0 ? void 0 : options.folder) === "string" ? options.folder.trim() : "",
            template: typeof (options === null || options === void 0 ? void 0 : options.template) === "string" ? options.template.trim() : "",
        };
    }
    catch (err) {
        console.warn("无法读取日记设置", err);
        return {
            format: DEFAULT_DAILY_NOTE_FORMAT,
            folder: "",
            template: "",
        };
    }
}
function getDateUID(date, granularity = "day") {
    const ts = date.clone().startOf(granularity).format();
    return `${granularity}-${ts}`;
}
function removeEscapedCharacters(format) {
    return format.replace(/\[[^\]]*\]/g, "");
}
function isFormatAmbiguous(format, granularity) {
    if (granularity === "week") {
        const cleanFormat = removeEscapedCharacters(format);
        return (/w{1,2}/i.test(cleanFormat) &&
            (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat)));
    }
    return false;
}
function getDateFromFilename(filename, granularity) {
    var _a;
    const getSettings = {
        day: getDailyNoteSettings,
        week: getDailyNoteSettings,
        month: getDailyNoteSettings,
        quarter: getDailyNoteSettings,
        year: getDailyNoteSettings,
    };
    const settingFn = getSettings[granularity];
    const formatSetting = ((_a = settingFn().format) !== null && _a !== void 0 ? _a : "").split("/").pop() ||
        DEFAULT_DAILY_NOTE_FORMAT;
    const noteDate = window.moment(filename, formatSetting, true);
    if (!noteDate.isValid()) {
        return null;
    }
    if (isFormatAmbiguous(formatSetting, granularity)) {
        if (granularity === "week") {
            const cleanFormat = removeEscapedCharacters(formatSetting);
            if (/w{1,2}/i.test(cleanFormat)) {
                return window.moment(filename, formatSetting.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""), false);
            }
        }
    }
    return noteDate;
}
function getDateFromFile(file, granularity) {
    return getDateFromFilename(file.basename, granularity);
}
function joinPaths(...segments) {
    const parts = [];
    for (const segment of segments) {
        parts.push(...segment.split("/"));
    }
    const result = [];
    for (const part of parts) {
        if (!part || part === ".") {
            continue;
        }
        result.push(part);
    }
    if (parts[0] === "") {
        result.unshift("");
    }
    return result.join("/");
}
async function ensureFolderExists(path) {
    const dirs = path.replace(/\\/g, "/").split("/");
    dirs.pop();
    if (dirs.length > 0) {
        const dir = joinPaths(...dirs);
        if (!getApp().vault.getAbstractFileByPath(dir)) {
            await getApp().vault.createFolder(dir);
        }
    }
}
async function getNotePath(directory, filename) {
    let name = filename;
    if (!name.endsWith(".md")) {
        name += ".md";
    }
    const path = obsidian.normalizePath(joinPaths(directory, name));
    await ensureFolderExists(path);
    return path;
}
async function getTemplateInfo(template) {
    const app = getApp();
    const templatePath = obsidian.normalizePath(template);
    if (templatePath === "/") {
        return ["", { folds: [] }];
    }
    try {
        const templateFile = app.metadataCache.getFirstLinkpathDest(templatePath, "");
        if (!templateFile) {
            throw new Error("模板文件未找到");
        }
        const contents = await app.vault.cachedRead(templateFile);
        const foldInfo = app.foldManager.load(templateFile);
        return [contents, foldInfo];
    }
    catch (err) {
        console.error(`读取日记模板失败 '${templatePath}'`, err);
        new obsidian.Notice("读取日记模板失败");
        return ["", { folds: [] }];
    }
}
async function createDailyNote(date) {
    const app = getApp();
    const { vault } = app;
    const { template, format, folder } = getDailyNoteSettings();
    const [templateContents, foldInfo] = await getTemplateInfo(template || "");
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder || "", filename);
    try {
        const createdFile = await vault.create(normalizedPath, templateContents
            .replace(/{{\s*date\s*}}/gi, filename)
            .replace(/{{\s*time\s*}}/gi, window.moment().format("HH:mm"))
            .replace(/{{\s*title\s*}}/gi, filename)
            .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi, (_match, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
            const now = window.moment();
            const currentDate = date.clone().set({
                hour: now.get("hour"),
                minute: now.get("minute"),
                second: now.get("second"),
            });
            if (calc) {
                currentDate.add(parseInt(timeDelta, 10), unit);
            }
            if (momentFormat) {
                return currentDate.format(momentFormat.substring(1).trim());
            }
            return currentDate.format(format);
        })
            .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
            .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "d").format(format)));
        app.foldManager.save(createdFile, foldInfo);
        return createdFile;
    }
    catch (err) {
        console.error(`创建文件失败: '${normalizedPath}'`, err);
        new obsidian.Notice("无法创建新日记文件");
        throw err;
    }
}
function getDailyNote(date, dailyNotes) {
    var _a;
    return (_a = dailyNotes[getDateUID(date, "day")]) !== null && _a !== void 0 ? _a : null;
}
function getAllDailyNotes() {
    const app = getApp();
    const { vault } = app;
    const { folder } = getDailyNoteSettings();
    const dailyNotesFolder = vault.getAbstractFileByPath(obsidian.normalizePath(folder || ""));
    if (!dailyNotesFolder) {
        throw new Error("未找到日记文件夹");
    }
    const dailyNotes = {};
    obsidian.Vault.recurseChildren(dailyNotesFolder, (note) => {
        if (note instanceof obsidian.TFile) {
            const noteDate = getDateFromFile(note, "day");
            if (noteDate) {
                const dateString = getDateUID(noteDate, "day");
                dailyNotes[dateString] = note;
            }
        }
    });
    return dailyNotes;
}

/**
 * 中文日期词库：序数词、星期、相对日期、特殊日期
 */
// ---- 序数词 ----
const ZH_ORDINALS = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
    "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15,
    "十六": 16, "十七": 17, "十八": 18, "十九": 19, "二十": 20,
    "二十一": 21, "二十二": 22, "二十三": 23, "二十四": 24, "二十五": 25,
    "二十六": 26, "二十七": 27, "二十八": 28, "二十九": 29, "三十": 30,
    "三十一": 31,
};
// ---- 星期 ----
const ZH_WEEKDAYS_LONG = [
    "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日",
];
const ZH_WEEKDAYS_SHORT = [
    "周一", "周二", "周三", "周四", "周五", "周六", "周日",
];
// ---- 相对日期 ----
const ZH_RELATIVE_DAYS = {
    "今天": 0,
    "今日": 0,
    "明天": 1,
    "明日": 1,
    "后天": 2,
    "後天": 2,
    "大后天": 3,
    "大後天": 3,
    "昨天": -1,
    "昨日": -1,
    "前天": -2,
    "大前天": -3,
};
// ---- 周期指示词 ----
const ZH_THIS = ["这个", "这", "本"];
const ZH_NEXT = ["下个", "下", "来"];
// ---- 周期单位 ----
const ZH_WEEK_WORDS = ["周", "星期", "礼拜"];
const ZH_MONTH_WORDS = ["月", "月份"];
const ZH_YEAR_WORDS = ["年"];
// ---- 特殊位置 ----
const ZH_POSITION = {
    endOfMonth: ["月底", "月末"],
    midOfMonth: ["月中"],
    startOfMonth: ["月初"],
    endOfYear: ["年底", "年末", "年终"],
    startOfYear: ["年初"],
};
// ---- 特殊公历日期 ----
const ZH_SPECIAL_DATES = {
    "元旦": { month: 1, day: 1 },
    "劳动节": { month: 5, day: 1 },
    "五一": { month: 5, day: 1 },
    "五四": { month: 5, day: 4 },
    "六一": { month: 6, day: 1 },
    "七一": { month: 7, day: 1 },
    "八一": { month: 8, day: 1 },
    "国庆": { month: 10, day: 1 },
    "十一": { month: 10, day: 1 },
    "圣诞": { month: 12, day: 25 },
    "圣诞节": { month: 12, day: 25 },
    "平安夜": { month: 12, day: 24 },
    "情人节": { month: 2, day: 14 },
    "愚人节": { month: 4, day: 1 },
    "万圣节": { month: 10, day: 31 },
    "感恩节": { month: 11, day: 27 }, // 近似，实际是11月第四个周四
    "除夕": { month: 1, day: 28 }, // 农历，仅作近似
    "元宵": { month: 2, day: 12 }, // 农历，仅作近似
    "端午": { month: 6, day: 1 }, // 农历，仅作近似
    "中秋": { month: 9, day: 15 }, // 农历，仅作近似
    "重阳": { month: 10, day: 9 }, // 农历，仅作近似
    "七夕": { month: 8, day: 4 }, // 农历，仅作近似
};

const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
function getWordBoundaries(editor) {
    const cursor = editor.getCursor();
    const pos = editor.posToOffset(cursor);
    const word = editor.cm.state.wordAt(pos);
    if (!word) {
        return {
            from: editor.offsetToPos(pos),
            to: editor.offsetToPos(pos),
        };
    }
    const wordStart = editor.offsetToPos(word.from);
    const wordEnd = editor.offsetToPos(word.to);
    return {
        from: wordStart,
        to: wordEnd,
    };
}
function getSelectedText(editor) {
    if (editor.somethingSelected()) {
        return editor.getSelection();
    }
    else {
        const wordBoundaries = getWordBoundaries(editor);
        editor.setSelection(wordBoundaries.from, wordBoundaries.to);
        return editor.getSelection();
    }
}
function adjustCursor(editor, cursor, newStr, oldStr) {
    const cursorOffset = newStr.length - oldStr.length;
    editor.setCursor({
        line: cursor.line,
        ch: cursor.ch + cursorOffset,
    });
}
function getFormattedDate(date, format) {
    return window.moment(date).format(format);
}
function getLastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
}
function parseTruthy(flag) {
    return ["y", "yes", "1", "t", "true"].indexOf(flag.toLowerCase()) >= 0;
}
function getLocaleWeekStart() {
    const localeData = window.moment.localeData();
    const startOfWeek = localeData._week.dow;
    return daysOfWeek[startOfWeek];
}
function generateMarkdownLink(app, subpath, alias) {
    const useMarkdownLinks = app.vault.getConfig("useMarkdownLinks");
    const path = obsidian.normalizePath(subpath);
    if (useMarkdownLinks) {
        if (alias) {
            return `[${alias}](${path.replace(/ /g, "%20")})`;
        }
        else {
            return `[${subpath}](${path})`;
        }
    }
    else {
        if (alias) {
            return `[[${path}|${alias}]]`;
        }
        else {
            return `[[${path}]]`;
        }
    }
}
function getDateLinkAlias(plugin, dateInput, useSuggestionLabel) {
    if (useSuggestionLabel) {
        return dateInput;
    }
    if (plugin.settings.defaultAlias) {
        const parsed = plugin.parseDate(dateInput);
        return parsed.moment.isValid()
            ? parsed.moment.format(plugin.settings.defaultAlias)
            : undefined;
    }
    return undefined;
}
async function getOrCreateDailyNote(date) {
    const desiredNote = getDailyNote(date, getAllDailyNotes());
    if (desiredNote) {
        return Promise.resolve(desiredNote);
    }
    return createDailyNote(date);
}

class DatePickerModal extends obsidian.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onOpen() {
        let previewEl;
        let dateInput = "";
        let momentFormat = this.plugin.settings.modalMomentFormat;
        let insertAsLink = this.plugin.settings.modalToggleLink;
        const getDateStr = () => {
            let cleanDateInput = dateInput;
            let shouldIncludeAlias = false;
            if (dateInput.endsWith("|")) {
                shouldIncludeAlias = true;
                cleanDateInput = dateInput.slice(0, -1);
            }
            const parsedDate = this.plugin.parseDate(cleanDateInput || "今天");
            let parsedDateString = parsedDate.moment.isValid()
                ? parsedDate.moment.format(momentFormat)
                : "";
            if (insertAsLink) {
                const alias = getDateLinkAlias(this.plugin, cleanDateInput, shouldIncludeAlias);
                parsedDateString = generateMarkdownLink(this.app, parsedDateString, alias);
            }
            return parsedDateString;
        };
        this.contentEl.createEl("form", {}, (formEl) => {
            const dateInputEl = new obsidian.Setting(formEl)
                .setName("日期")
                .setDesc(getDateStr())
                .addText((textEl) => {
                textEl.setPlaceholder("今天");
                textEl.onChange((value) => {
                    dateInput = value;
                    previewEl.setText(getDateStr());
                });
                window.setTimeout(() => textEl.inputEl.focus(), 10);
            });
            previewEl = dateInputEl.descEl;
            new obsidian.Setting(formEl)
                .setName("日期格式")
                .setDesc("Moment.js 格式字符串")
                .addMomentFormat((momentEl) => {
                momentEl.setPlaceholder("输入格式");
                momentEl.setValue(momentFormat);
                momentEl.onChange((value) => {
                    momentFormat = value.trim() || "YYYY-MM-DD HH:mm";
                    this.plugin.settings.modalMomentFormat = momentFormat;
                    void this.plugin.saveSettings();
                    previewEl.setText(getDateStr());
                });
            });
            new obsidian.Setting(formEl)
                .setName("插入为链接？")
                .addToggle((toggleEl) => {
                toggleEl
                    .setValue(this.plugin.settings.modalToggleLink)
                    .onChange((value) => {
                    insertAsLink = value;
                    this.plugin.settings.modalToggleLink = insertAsLink;
                    void this.plugin.saveSettings();
                    previewEl.setText(getDateStr());
                });
            });
            formEl.createDiv("modal-button-container", (buttonContainerEl) => {
                buttonContainerEl
                    .createEl("button", {
                    attr: { type: "button" },
                    text: "取消",
                })
                    .addEventListener("click", () => this.close());
                buttonContainerEl.createEl("button", {
                    attr: { type: "submit" },
                    cls: "mod-cta",
                    text: "插入日期",
                });
            });
            const activeView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
            if (activeView) {
                const activeEditor = activeView.editor;
                formEl.addEventListener("submit", (e) => {
                    e.preventDefault();
                    this.close();
                    activeEditor.replaceSelection(getDateStr());
                });
            }
        });
    }
}

var Meridiem;
(function (Meridiem) {
    Meridiem[Meridiem["AM"] = 0] = "AM";
    Meridiem[Meridiem["PM"] = 1] = "PM";
})(Meridiem || (Meridiem = {}));
var Weekday;
(function (Weekday) {
    Weekday[Weekday["SUNDAY"] = 0] = "SUNDAY";
    Weekday[Weekday["MONDAY"] = 1] = "MONDAY";
    Weekday[Weekday["TUESDAY"] = 2] = "TUESDAY";
    Weekday[Weekday["WEDNESDAY"] = 3] = "WEDNESDAY";
    Weekday[Weekday["THURSDAY"] = 4] = "THURSDAY";
    Weekday[Weekday["FRIDAY"] = 5] = "FRIDAY";
    Weekday[Weekday["SATURDAY"] = 6] = "SATURDAY";
})(Weekday || (Weekday = {}));
var Month;
(function (Month) {
    Month[Month["JANUARY"] = 1] = "JANUARY";
    Month[Month["FEBRUARY"] = 2] = "FEBRUARY";
    Month[Month["MARCH"] = 3] = "MARCH";
    Month[Month["APRIL"] = 4] = "APRIL";
    Month[Month["MAY"] = 5] = "MAY";
    Month[Month["JUNE"] = 6] = "JUNE";
    Month[Month["JULY"] = 7] = "JULY";
    Month[Month["AUGUST"] = 8] = "AUGUST";
    Month[Month["SEPTEMBER"] = 9] = "SEPTEMBER";
    Month[Month["OCTOBER"] = 10] = "OCTOBER";
    Month[Month["NOVEMBER"] = 11] = "NOVEMBER";
    Month[Month["DECEMBER"] = 12] = "DECEMBER";
})(Month || (Month = {}));

function assignSimilarDate(component, target) {
    component.assign("day", target.getDate());
    component.assign("month", target.getMonth() + 1);
    component.assign("year", target.getFullYear());
}
function assignSimilarTime(component, target) {
    component.assign("hour", target.getHours());
    component.assign("minute", target.getMinutes());
    component.assign("second", target.getSeconds());
    component.assign("millisecond", target.getMilliseconds());
    component.assign("meridiem", target.getHours() < 12 ? Meridiem.AM : Meridiem.PM);
}
function implySimilarDate(component, target) {
    component.imply("day", target.getDate());
    component.imply("month", target.getMonth() + 1);
    component.imply("year", target.getFullYear());
}
function implySimilarTime(component, target) {
    component.imply("hour", target.getHours());
    component.imply("minute", target.getMinutes());
    component.imply("second", target.getSeconds());
    component.imply("millisecond", target.getMilliseconds());
    component.imply("meridiem", target.getHours() < 12 ? Meridiem.AM : Meridiem.PM);
}

const TIMEZONE_ABBR_MAP = {
    ACDT: 630,
    ACST: 570,
    ADT: -180,
    AEDT: 660,
    AEST: 600,
    AFT: 270,
    AKDT: -480,
    AKST: -540,
    ALMT: 360,
    AMST: -180,
    AMT: -240,
    ANAST: 720,
    ANAT: 720,
    AQTT: 300,
    ART: -180,
    AST: -240,
    AWDT: 540,
    AWST: 480,
    AZOST: 0,
    AZOT: -60,
    AZST: 300,
    AZT: 240,
    BNT: 480,
    BOT: -240,
    BRST: -120,
    BRT: -180,
    BST: 60,
    BTT: 360,
    CAST: 480,
    CAT: 120,
    CCT: 390,
    CDT: -300,
    CEST: 120,
    CET: {
        timezoneOffsetDuringDst: 2 * 60,
        timezoneOffsetNonDst: 60,
        dstStart: (year) => getLastWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2),
        dstEnd: (year) => getLastWeekdayOfMonth(year, Month.OCTOBER, Weekday.SUNDAY, 3),
    },
    CHADT: 825,
    CHAST: 765,
    CKT: -600,
    CLST: -180,
    CLT: -240,
    COT: -300,
    CST: -360,
    CT: {
        timezoneOffsetDuringDst: -5 * 60,
        timezoneOffsetNonDst: -6 * 60,
        dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
        dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2),
    },
    CVT: -60,
    CXT: 420,
    ChST: 600,
    DAVT: 420,
    EASST: -300,
    EAST: -360,
    EAT: 180,
    ECT: -300,
    EDT: -240,
    EEST: 180,
    EET: 120,
    EGST: 0,
    EGT: -60,
    EST: -300,
    ET: {
        timezoneOffsetDuringDst: -4 * 60,
        timezoneOffsetNonDst: -5 * 60,
        dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
        dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2),
    },
    FJST: 780,
    FJT: 720,
    FKST: -180,
    FKT: -240,
    FNT: -120,
    GALT: -360,
    GAMT: -540,
    GET: 240,
    GFT: -180,
    GILT: 720,
    GMT: 0,
    GST: 240,
    GYT: -240,
    HAA: -180,
    HAC: -300,
    HADT: -540,
    HAE: -240,
    HAP: -420,
    HAR: -360,
    HAST: -600,
    HAT: -90,
    HAY: -480,
    HKT: 480,
    HLV: -210,
    HNA: -240,
    HNC: -360,
    HNE: -300,
    HNP: -480,
    HNR: -420,
    HNT: -150,
    HNY: -540,
    HOVT: 420,
    ICT: 420,
    IDT: 180,
    IOT: 360,
    IRDT: 270,
    IRKST: 540,
    IRKT: 540,
    IRST: 210,
    IST: 330,
    JST: 540,
    KGT: 360,
    KRAST: 480,
    KRAT: 480,
    KST: 540,
    KUYT: 240,
    LHDT: 660,
    LHST: 630,
    LINT: 840,
    MAGST: 720,
    MAGT: 720,
    MART: -510,
    MAWT: 300,
    MDT: -360,
    MESZ: 120,
    MEZ: 60,
    MHT: 720,
    MMT: 390,
    MSD: 240,
    MSK: 180,
    MST: -420,
    MT: {
        timezoneOffsetDuringDst: -6 * 60,
        timezoneOffsetNonDst: -7 * 60,
        dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
        dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2),
    },
    MUT: 240,
    MVT: 300,
    MYT: 480,
    NCT: 660,
    NDT: -90,
    NFT: 690,
    NOVST: 420,
    NOVT: 360,
    NPT: 345,
    NST: -150,
    NUT: -660,
    NZDT: 780,
    NZST: 720,
    OMSST: 420,
    OMST: 420,
    PDT: -420,
    PET: -300,
    PETST: 720,
    PETT: 720,
    PGT: 600,
    PHOT: 780,
    PHT: 480,
    PKT: 300,
    PMDT: -120,
    PMST: -180,
    PONT: 660,
    PST: -480,
    PT: {
        timezoneOffsetDuringDst: -7 * 60,
        timezoneOffsetNonDst: -8 * 60,
        dstStart: (year) => getNthWeekdayOfMonth(year, Month.MARCH, Weekday.SUNDAY, 2, 2),
        dstEnd: (year) => getNthWeekdayOfMonth(year, Month.NOVEMBER, Weekday.SUNDAY, 1, 2),
    },
    PWT: 540,
    PYST: -180,
    PYT: -240,
    RET: 240,
    SAMT: 240,
    SAST: 120,
    SBT: 660,
    SCT: 240,
    SGT: 480,
    SRT: -180,
    SST: -660,
    TAHT: -600,
    TFT: 300,
    TJT: 300,
    TKT: 780,
    TLT: 540,
    TMT: 300,
    TVT: 720,
    ULAT: 480,
    UTC: 0,
    UYST: -120,
    UYT: -180,
    UZT: 300,
    VET: -210,
    VLAST: 660,
    VLAT: 660,
    VUT: 660,
    WAST: 120,
    WAT: 60,
    WEST: 60,
    WESZ: 60,
    WET: 0,
    WEZ: 0,
    WFT: 720,
    WGST: -120,
    WGT: -180,
    WIB: 420,
    WIT: 540,
    WITA: 480,
    WST: 780,
    WT: 0,
    YAKST: 600,
    YAKT: 600,
    YAPT: 600,
    YEKST: 360,
    YEKT: 360,
};
function getNthWeekdayOfMonth(year, month, weekday, n, hour = 0) {
    let dayOfMonth = 0;
    let i = 0;
    while (i < n) {
        dayOfMonth++;
        const date = new Date(year, month - 1, dayOfMonth);
        if (date.getDay() === weekday)
            i++;
    }
    return new Date(year, month - 1, dayOfMonth, hour);
}
function getLastWeekdayOfMonth(year, month, weekday, hour = 0) {
    const oneIndexedWeekday = weekday === 0 ? 7 : weekday;
    const date = new Date(year, month - 1 + 1, 1, 12);
    const firstWeekdayNextMonth = date.getDay() === 0 ? 7 : date.getDay();
    let dayDiff;
    if (firstWeekdayNextMonth === oneIndexedWeekday)
        dayDiff = 7;
    else if (firstWeekdayNextMonth < oneIndexedWeekday)
        dayDiff = 7 + firstWeekdayNextMonth - oneIndexedWeekday;
    else
        dayDiff = firstWeekdayNextMonth - oneIndexedWeekday;
    date.setDate(date.getDate() - dayDiff);
    return new Date(year, month - 1, date.getDate(), hour);
}
function toTimezoneOffset(timezoneInput, date, timezoneOverrides = {}) {
    if (timezoneInput == null) {
        return null;
    }
    if (typeof timezoneInput === "number") {
        return timezoneInput;
    }
    const matchedTimezone = timezoneOverrides[timezoneInput] ?? TIMEZONE_ABBR_MAP[timezoneInput];
    if (matchedTimezone == null) {
        return null;
    }
    if (typeof matchedTimezone == "number") {
        return matchedTimezone;
    }
    if (date == null) {
        return null;
    }
    if (date > matchedTimezone.dstStart(date.getFullYear()) && !(date > matchedTimezone.dstEnd(date.getFullYear()))) {
        return matchedTimezone.timezoneOffsetDuringDst;
    }
    return matchedTimezone.timezoneOffsetNonDst;
}

const EmptyDuration = {
    day: 0,
    second: 0,
    millisecond: 0,
};
function addDuration(ref, duration) {
    let date = new Date(ref);
    if (duration["y"]) {
        duration["year"] = duration["y"];
        delete duration["y"];
    }
    if (duration["mo"]) {
        duration["month"] = duration["mo"];
        delete duration["mo"];
    }
    if (duration["M"]) {
        duration["month"] = duration["M"];
        delete duration["M"];
    }
    if (duration["w"]) {
        duration["week"] = duration["w"];
        delete duration["w"];
    }
    if (duration["d"]) {
        duration["day"] = duration["d"];
        delete duration["d"];
    }
    if (duration["h"]) {
        duration["hour"] = duration["h"];
        delete duration["h"];
    }
    if (duration["m"]) {
        duration["minute"] = duration["m"];
        delete duration["m"];
    }
    if (duration["s"]) {
        duration["second"] = duration["s"];
        delete duration["s"];
    }
    if (duration["ms"]) {
        duration["millisecond"] = duration["ms"];
        delete duration["ms"];
    }
    if ("year" in duration) {
        const floor = Math.floor(duration["year"]);
        date.setFullYear(date.getFullYear() + floor);
        const remainingFraction = duration["year"] - floor;
        if (remainingFraction > 0) {
            duration.month = duration?.month ?? 0;
            duration.month += remainingFraction * 12;
        }
    }
    if ("quarter" in duration) {
        const floor = Math.floor(duration["quarter"]);
        date.setMonth(date.getMonth() + floor * 3);
    }
    if ("month" in duration) {
        const floor = Math.floor(duration["month"]);
        date.setMonth(date.getMonth() + floor);
        const remainingFraction = duration["month"] - floor;
        if (remainingFraction > 0) {
            duration.week = duration?.week ?? 0;
            duration.week += remainingFraction * 4;
        }
    }
    if ("week" in duration) {
        const floor = Math.floor(duration["week"]);
        date.setDate(date.getDate() + floor * 7);
        const remainingFraction = duration["week"] - floor;
        if (remainingFraction > 0) {
            duration.day = duration?.day ?? 0;
            duration.day += Math.round(remainingFraction * 7);
        }
    }
    if ("day" in duration) {
        const floor = Math.floor(duration["day"]);
        date.setDate(date.getDate() + floor);
        const remainingFraction = duration["day"] - floor;
        if (remainingFraction > 0) {
            duration.hour = duration?.hour ?? 0;
            duration.hour += Math.round(remainingFraction * 24);
        }
    }
    if ("hour" in duration) {
        const floor = Math.floor(duration["hour"]);
        date.setHours(date.getHours() + floor);
        const remainingFraction = duration["hour"] - floor;
        if (remainingFraction > 0) {
            duration.minute = duration?.minute ?? 0;
            duration.minute += Math.round(remainingFraction * 60);
        }
    }
    if ("minute" in duration) {
        const floor = Math.floor(duration["minute"]);
        date.setMinutes(date.getMinutes() + floor);
        const remainingFraction = duration["minute"] - floor;
        if (remainingFraction > 0) {
            duration.second = duration?.second ?? 0;
            duration.second += Math.round(remainingFraction * 60);
        }
    }
    if ("second" in duration) {
        const floor = Math.floor(duration["second"]);
        date.setSeconds(date.getSeconds() + floor);
        const remainingFraction = duration["second"] - floor;
        if (remainingFraction > 0) {
            duration.millisecond = duration?.millisecond ?? 0;
            duration.millisecond += Math.round(remainingFraction * 1000);
        }
    }
    if ("millisecond" in duration) {
        const floor = Math.floor(duration["millisecond"]);
        date.setMilliseconds(date.getMilliseconds() + floor);
    }
    return date;
}
function reverseDuration(duration) {
    const reversed = {};
    for (const key in duration) {
        reversed[key] = -duration[key];
    }
    return reversed;
}

class ReferenceWithTimezone {
    instant;
    timezoneOffset;
    constructor(instant, timezoneOffset) {
        this.instant = instant ?? new Date();
        this.timezoneOffset = timezoneOffset ?? null;
    }
    static fromDate(date) {
        return new ReferenceWithTimezone(date);
    }
    static fromInput(input, timezoneOverrides) {
        if (input instanceof Date) {
            return ReferenceWithTimezone.fromDate(input);
        }
        const instant = input?.instant ?? new Date();
        const timezoneOffset = toTimezoneOffset(input?.timezone, instant, timezoneOverrides);
        return new ReferenceWithTimezone(instant, timezoneOffset);
    }
    getDateWithAdjustedTimezone() {
        const date = new Date(this.instant);
        if (this.timezoneOffset !== null) {
            date.setMinutes(date.getMinutes() - this.getSystemTimezoneAdjustmentMinute(this.instant));
        }
        return date;
    }
    getSystemTimezoneAdjustmentMinute(date, overrideTimezoneOffset) {
        if (!date) {
            date = new Date();
        }
        const currentTimezoneOffset = -date.getTimezoneOffset();
        const targetTimezoneOffset = overrideTimezoneOffset ?? this.timezoneOffset ?? currentTimezoneOffset;
        return currentTimezoneOffset - targetTimezoneOffset;
    }
    getTimezoneOffset() {
        return this.timezoneOffset ?? -this.instant.getTimezoneOffset();
    }
}
class ParsingComponents {
    knownValues;
    impliedValues;
    reference;
    _tags = new Set();
    constructor(reference, knownComponents) {
        this.reference = reference;
        this.knownValues = {};
        this.impliedValues = {};
        if (knownComponents) {
            for (const key in knownComponents) {
                this.knownValues[key] = knownComponents[key];
            }
        }
        const date = reference.getDateWithAdjustedTimezone();
        this.imply("day", date.getDate());
        this.imply("month", date.getMonth() + 1);
        this.imply("year", date.getFullYear());
        this.imply("hour", 12);
        this.imply("minute", 0);
        this.imply("second", 0);
        this.imply("millisecond", 0);
    }
    static createRelativeFromReference(reference, duration = EmptyDuration) {
        let date = addDuration(reference.getDateWithAdjustedTimezone(), duration);
        const components = new ParsingComponents(reference);
        components.addTag("result/relativeDate");
        if ("hour" in duration || "minute" in duration || "second" in duration || "millisecond" in duration) {
            components.addTag("result/relativeDateAndTime");
            assignSimilarTime(components, date);
            assignSimilarDate(components, date);
            components.assign("timezoneOffset", reference.getTimezoneOffset());
        }
        else {
            implySimilarTime(components, date);
            components.imply("timezoneOffset", reference.getTimezoneOffset());
            if ("day" in duration) {
                components.assign("day", date.getDate());
                components.assign("month", date.getMonth() + 1);
                components.assign("year", date.getFullYear());
                components.assign("weekday", date.getDay());
            }
            else if ("week" in duration) {
                components.assign("day", date.getDate());
                components.assign("month", date.getMonth() + 1);
                components.assign("year", date.getFullYear());
                components.imply("weekday", date.getDay());
            }
            else {
                components.imply("day", date.getDate());
                if ("month" in duration) {
                    components.assign("month", date.getMonth() + 1);
                    components.assign("year", date.getFullYear());
                }
                else {
                    components.imply("month", date.getMonth() + 1);
                    if ("year" in duration) {
                        components.assign("year", date.getFullYear());
                    }
                    else {
                        components.imply("year", date.getFullYear());
                    }
                }
            }
        }
        return components;
    }
    get(component) {
        if (component in this.knownValues) {
            return this.knownValues[component];
        }
        if (component in this.impliedValues) {
            return this.impliedValues[component];
        }
        return null;
    }
    isCertain(component) {
        return component in this.knownValues;
    }
    getCertainComponents() {
        return Object.keys(this.knownValues);
    }
    imply(component, value) {
        if (component in this.knownValues) {
            return this;
        }
        this.impliedValues[component] = value;
        return this;
    }
    assign(component, value) {
        this.knownValues[component] = value;
        delete this.impliedValues[component];
        return this;
    }
    addDurationAsImplied(duration) {
        const currentDate = this.dateWithoutTimezoneAdjustment();
        const date = addDuration(currentDate, duration);
        if ("day" in duration || "week" in duration || "month" in duration || "year" in duration) {
            this.delete(["day", "weekday", "month", "year"]);
            this.imply("day", date.getDate());
            this.imply("weekday", date.getDay());
            this.imply("month", date.getMonth() + 1);
            this.imply("year", date.getFullYear());
        }
        if ("second" in duration || "minute" in duration || "hour" in duration) {
            this.delete(["second", "minute", "hour"]);
            this.imply("second", date.getSeconds());
            this.imply("minute", date.getMinutes());
            this.imply("hour", date.getHours());
        }
        return this;
    }
    delete(components) {
        if (typeof components === "string") {
            components = [components];
        }
        for (const component of components) {
            delete this.knownValues[component];
            delete this.impliedValues[component];
        }
    }
    clone() {
        const component = new ParsingComponents(this.reference);
        component.knownValues = {};
        component.impliedValues = {};
        for (const key in this.knownValues) {
            component.knownValues[key] = this.knownValues[key];
        }
        for (const key in this.impliedValues) {
            component.impliedValues[key] = this.impliedValues[key];
        }
        return component;
    }
    isOnlyDate() {
        return !this.isCertain("hour") && !this.isCertain("minute") && !this.isCertain("second");
    }
    isOnlyTime() {
        return (!this.isCertain("weekday") && !this.isCertain("day") && !this.isCertain("month") && !this.isCertain("year"));
    }
    isOnlyWeekdayComponent() {
        return this.isCertain("weekday") && !this.isCertain("day") && !this.isCertain("month");
    }
    isDateWithUnknownYear() {
        return this.isCertain("month") && !this.isCertain("year");
    }
    isValidDate() {
        const date = this.dateWithoutTimezoneAdjustment();
        if (date.getFullYear() !== this.get("year"))
            return false;
        if (date.getMonth() !== this.get("month") - 1)
            return false;
        if (date.getDate() !== this.get("day"))
            return false;
        if (this.get("hour") != null && date.getHours() != this.get("hour"))
            return false;
        if (this.get("minute") != null && date.getMinutes() != this.get("minute"))
            return false;
        return true;
    }
    toString() {
        return `[ParsingComponents {
            tags: ${JSON.stringify(Array.from(this._tags).sort())}, 
            knownValues: ${JSON.stringify(this.knownValues)}, 
            impliedValues: ${JSON.stringify(this.impliedValues)}}, 
            reference: ${JSON.stringify(this.reference)}]`;
    }
    date() {
        const date = this.dateWithoutTimezoneAdjustment();
        const timezoneAdjustment = this.reference.getSystemTimezoneAdjustmentMinute(date, this.get("timezoneOffset"));
        return new Date(date.getTime() + timezoneAdjustment * 60000);
    }
    addTag(tag) {
        this._tags.add(tag);
        return this;
    }
    addTags(tags) {
        for (const tag of tags) {
            this._tags.add(tag);
        }
        return this;
    }
    tags() {
        return new Set(this._tags);
    }
    dateWithoutTimezoneAdjustment() {
        const date = new Date(this.get("year"), this.get("month") - 1, this.get("day"), this.get("hour"), this.get("minute"), this.get("second"), this.get("millisecond"));
        date.setFullYear(this.get("year"));
        return date;
    }
}
class ParsingResult {
    refDate;
    index;
    text;
    reference;
    start;
    end;
    constructor(reference, index, text, start, end) {
        this.reference = reference;
        this.refDate = reference.instant;
        this.index = index;
        this.text = text;
        this.start = start || new ParsingComponents(reference);
        this.end = end;
    }
    clone() {
        const result = new ParsingResult(this.reference, this.index, this.text);
        result.start = this.start ? this.start.clone() : null;
        result.end = this.end ? this.end.clone() : null;
        return result;
    }
    date() {
        return this.start.date();
    }
    addTag(tag) {
        this.start.addTag(tag);
        if (this.end) {
            this.end.addTag(tag);
        }
        return this;
    }
    addTags(tags) {
        this.start.addTags(tags);
        if (this.end) {
            this.end.addTags(tags);
        }
        return this;
    }
    tags() {
        const combinedTags = new Set(this.start.tags());
        if (this.end) {
            for (const tag of this.end.tags()) {
                combinedTags.add(tag);
            }
        }
        return combinedTags;
    }
    toString() {
        const tags = Array.from(this.tags()).sort();
        return `[ParsingResult {index: ${this.index}, text: '${this.text}', tags: ${JSON.stringify(tags)} ...}]`;
    }
}

function repeatedTimeunitPattern(prefix, singleTimeunitPattern, connectorPattern = "\\s{0,5},?\\s{0,5}") {
    const singleTimeunitPatternNoCapture = singleTimeunitPattern.replace(/\((?!\?)/g, "(?:");
    return `${prefix}${singleTimeunitPatternNoCapture}(?:${connectorPattern}${singleTimeunitPatternNoCapture}){0,10}`;
}
function extractTerms(dictionary) {
    let keys;
    if (dictionary instanceof Array) {
        keys = [...dictionary];
    }
    else if (dictionary instanceof Map) {
        keys = Array.from(dictionary.keys());
    }
    else {
        keys = Object.keys(dictionary);
    }
    return keys;
}
function matchAnyPattern(dictionary) {
    const joinedTerms = extractTerms(dictionary)
        .sort((a, b) => b.length - a.length)
        .join("|")
        .replace(/\./g, "\\.");
    return `(?:${joinedTerms})`;
}

function findMostLikelyADYear(yearNumber) {
    if (yearNumber < 100) {
        if (yearNumber > 50) {
            yearNumber = yearNumber + 1900;
        }
        else {
            yearNumber = yearNumber + 2000;
        }
    }
    return yearNumber;
}
function findYearClosestToRef(refDate, day, month) {
    let date = new Date(refDate);
    date.setMonth(month - 1);
    date.setDate(day);
    const nextYear = addDuration(date, { "year": 1 });
    const lastYear = addDuration(date, { "year": -1 });
    if (Math.abs(nextYear.getTime() - refDate.getTime()) < Math.abs(date.getTime() - refDate.getTime())) {
        date = nextYear;
    }
    else if (Math.abs(lastYear.getTime() - refDate.getTime()) < Math.abs(date.getTime() - refDate.getTime())) {
        date = lastYear;
    }
    return date.getFullYear();
}

const WEEKDAY_DICTIONARY = {
    sunday: 0,
    sun: 0,
    "sun.": 0,
    monday: 1,
    mon: 1,
    "mon.": 1,
    tuesday: 2,
    tue: 2,
    "tue.": 2,
    wednesday: 3,
    wed: 3,
    "wed.": 3,
    thursday: 4,
    thurs: 4,
    "thurs.": 4,
    thur: 4,
    "thur.": 4,
    thu: 4,
    "thu.": 4,
    friday: 5,
    fri: 5,
    "fri.": 5,
    saturday: 6,
    sat: 6,
    "sat.": 6,
};
const FULL_MONTH_NAME_DICTIONARY = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
};
const MONTH_DICTIONARY = {
    ...FULL_MONTH_NAME_DICTIONARY,
    jan: 1,
    "jan.": 1,
    feb: 2,
    "feb.": 2,
    mar: 3,
    "mar.": 3,
    apr: 4,
    "apr.": 4,
    jun: 6,
    "jun.": 6,
    jul: 7,
    "jul.": 7,
    aug: 8,
    "aug.": 8,
    sep: 9,
    "sep.": 9,
    sept: 9,
    "sept.": 9,
    oct: 10,
    "oct.": 10,
    nov: 11,
    "nov.": 11,
    dec: 12,
    "dec.": 12,
};
const INTEGER_WORD_DICTIONARY = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
};
const ORDINAL_WORD_DICTIONARY = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
    thirteenth: 13,
    fourteenth: 14,
    fifteenth: 15,
    sixteenth: 16,
    seventeenth: 17,
    eighteenth: 18,
    nineteenth: 19,
    twentieth: 20,
    "twenty first": 21,
    "twenty-first": 21,
    "twenty second": 22,
    "twenty-second": 22,
    "twenty third": 23,
    "twenty-third": 23,
    "twenty fourth": 24,
    "twenty-fourth": 24,
    "twenty fifth": 25,
    "twenty-fifth": 25,
    "twenty sixth": 26,
    "twenty-sixth": 26,
    "twenty seventh": 27,
    "twenty-seventh": 27,
    "twenty eighth": 28,
    "twenty-eighth": 28,
    "twenty ninth": 29,
    "twenty-ninth": 29,
    "thirtieth": 30,
    "thirty first": 31,
    "thirty-first": 31,
};
const TIME_UNIT_DICTIONARY_NO_ABBR = {
    second: "second",
    seconds: "second",
    minute: "minute",
    minutes: "minute",
    hour: "hour",
    hours: "hour",
    day: "day",
    days: "day",
    week: "week",
    weeks: "week",
    month: "month",
    months: "month",
    quarter: "quarter",
    quarters: "quarter",
    year: "year",
    years: "year",
};
const TIME_UNIT_DICTIONARY = {
    s: "second",
    sec: "second",
    second: "second",
    seconds: "second",
    m: "minute",
    min: "minute",
    mins: "minute",
    minute: "minute",
    minutes: "minute",
    h: "hour",
    hr: "hour",
    hrs: "hour",
    hour: "hour",
    hours: "hour",
    d: "day",
    day: "day",
    days: "day",
    w: "week",
    week: "week",
    weeks: "week",
    mo: "month",
    mon: "month",
    mos: "month",
    month: "month",
    months: "month",
    qtr: "quarter",
    quarter: "quarter",
    quarters: "quarter",
    y: "year",
    yr: "year",
    year: "year",
    years: "year",
    ...TIME_UNIT_DICTIONARY_NO_ABBR,
};
const NUMBER_PATTERN = `(?:${matchAnyPattern(INTEGER_WORD_DICTIONARY)}|[0-9]+|[0-9]+\\.[0-9]+|half(?:\\s{0,2}an?)?|an?\\b(?:\\s{0,2}few)?|few|several|the|a?\\s{0,2}couple\\s{0,2}(?:of)?)`;
function parseNumberPattern(match) {
    const num = match.toLowerCase();
    if (INTEGER_WORD_DICTIONARY[num] !== undefined) {
        return INTEGER_WORD_DICTIONARY[num];
    }
    else if (num === "a" || num === "an" || num == "the") {
        return 1;
    }
    else if (num.match(/few/)) {
        return 3;
    }
    else if (num.match(/half/)) {
        return 0.5;
    }
    else if (num.match(/couple/)) {
        return 2;
    }
    else if (num.match(/several/)) {
        return 7;
    }
    return parseFloat(num);
}
const ORDINAL_NUMBER_PATTERN = `(?:${matchAnyPattern(ORDINAL_WORD_DICTIONARY)}|[0-9]{1,2}(?:st|nd|rd|th)?)`;
function parseOrdinalNumberPattern(match) {
    let num = match.toLowerCase();
    if (ORDINAL_WORD_DICTIONARY[num] !== undefined) {
        return ORDINAL_WORD_DICTIONARY[num];
    }
    num = num.replace(/(?:st|nd|rd|th)$/i, "");
    return parseInt(num);
}
const YEAR_PATTERN$1 = `(?:[1-9][0-9]{0,3}\\s{0,2}(?:BE|AD|BC|BCE|CE)|[1-9][0-9]{3}|[5-9][0-9]|2[0-5])`;
function parseYear(match) {
    if (/BE/i.test(match)) {
        match = match.replace(/BE/i, "");
        return parseInt(match) - 543;
    }
    if (/BCE?/i.test(match)) {
        match = match.replace(/BCE?/i, "");
        return -parseInt(match);
    }
    if (/(AD|CE)/i.test(match)) {
        match = match.replace(/(AD|CE)/i, "");
        return parseInt(match);
    }
    const rawYearNumber = parseInt(match);
    return findMostLikelyADYear(rawYearNumber);
}
const SINGLE_TIME_UNIT_PATTERN = `(${NUMBER_PATTERN})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY)})`;
const SINGLE_TIME_UNIT_REGEX = new RegExp(SINGLE_TIME_UNIT_PATTERN, "i");
const SINGLE_TIME_UNIT_NO_ABBR_PATTERN = `(${NUMBER_PATTERN})\\s{0,3}(${matchAnyPattern(TIME_UNIT_DICTIONARY_NO_ABBR)})`;
const TIME_UNIT_CONNECTOR_PATTERN = `\\s{0,5},?(?:\\s*and)?\\s{0,5}`;
const TIME_UNITS_PATTERN = repeatedTimeunitPattern(`(?:(?:about|around)\\s{0,3})?`, SINGLE_TIME_UNIT_PATTERN, TIME_UNIT_CONNECTOR_PATTERN);
const TIME_UNITS_NO_ABBR_PATTERN = repeatedTimeunitPattern(`(?:(?:about|around)\\s{0,3})?`, SINGLE_TIME_UNIT_NO_ABBR_PATTERN, TIME_UNIT_CONNECTOR_PATTERN);
function parseDuration(timeunitText) {
    const fragments = {};
    let remainingText = timeunitText;
    let match = SINGLE_TIME_UNIT_REGEX.exec(remainingText);
    while (match) {
        collectDateTimeFragment(fragments, match);
        remainingText = remainingText.substring(match[0].length).trim();
        match = SINGLE_TIME_UNIT_REGEX.exec(remainingText);
    }
    if (Object.keys(fragments).length == 0) {
        return null;
    }
    return fragments;
}
function collectDateTimeFragment(fragments, match) {
    if (match[0].match(/^[a-zA-Z]+$/)) {
        return;
    }
    const num = parseNumberPattern(match[1]);
    const unit = TIME_UNIT_DICTIONARY[match[2].toLowerCase()];
    fragments[unit] = num;
}

class AbstractParserWithWordBoundaryChecking {
    innerPatternHasChange(context, currentInnerPattern) {
        return this.innerPattern(context) !== currentInnerPattern;
    }
    patternLeftBoundary() {
        return `(\\W|^)`;
    }
    cachedInnerPattern = null;
    cachedPattern = null;
    pattern(context) {
        if (this.cachedInnerPattern) {
            if (!this.innerPatternHasChange(context, this.cachedInnerPattern)) {
                return this.cachedPattern;
            }
        }
        this.cachedInnerPattern = this.innerPattern(context);
        this.cachedPattern = new RegExp(`${this.patternLeftBoundary()}${this.cachedInnerPattern.source}`, this.cachedInnerPattern.flags);
        return this.cachedPattern;
    }
    extract(context, match) {
        const header = match[1] ?? "";
        match.index = match.index + header.length;
        match[0] = match[0].substring(header.length);
        for (let i = 2; i < match.length; i++) {
            match[i - 1] = match[i];
        }
        return this.innerExtract(context, match);
    }
}

const PATTERN_WITH_OPTIONAL_PREFIX = new RegExp(`(?:(?:within|in|for)\\s*)?` +
    `(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
const PATTERN_WITH_PREFIX = new RegExp(`(?:within|in|for)\\s*` +
    `(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
const PATTERN_WITH_PREFIX_STRICT = new RegExp(`(?:within|in|for)\\s*` +
    `(?:(?:about|around|roughly|approximately|just)\\s*(?:~\\s*)?)?(${TIME_UNITS_NO_ABBR_PATTERN})(?=\\W|$)`, "i");
class ENTimeUnitWithinFormatParser extends AbstractParserWithWordBoundaryChecking {
    strictMode;
    constructor(strictMode) {
        super();
        this.strictMode = strictMode;
    }
    innerPattern(context) {
        if (this.strictMode) {
            return PATTERN_WITH_PREFIX_STRICT;
        }
        return context.option.forwardDate ? PATTERN_WITH_OPTIONAL_PREFIX : PATTERN_WITH_PREFIX;
    }
    innerExtract(context, match) {
        if (match[0].match(/^for\s*the\s*\w+/)) {
            return null;
        }
        const timeUnits = parseDuration(match[1]);
        if (!timeUnits) {
            return null;
        }
        return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
}

const PATTERN$g = new RegExp(`(?:on\\s{0,3})?` +
    `(${ORDINAL_NUMBER_PATTERN})` +
    `(?:` +
    `\\s{0,3}(?:to|\\-|\\–|until|through|till)?\\s{0,3}` +
    `(${ORDINAL_NUMBER_PATTERN})` +
    ")?" +
    `(?:-|/|\\s{0,3}(?:of)?\\s{0,3})` +
    `(${matchAnyPattern(MONTH_DICTIONARY)})` +
    "(?:" +
    `(?:-|/|,?\\s{0,3})` +
    `(${YEAR_PATTERN$1}(?!\\w))` +
    ")?" +
    "(?=\\W|$)", "i");
const DATE_GROUP$1 = 1;
const DATE_TO_GROUP$1 = 2;
const MONTH_NAME_GROUP$3 = 3;
const YEAR_GROUP$6 = 4;
class ENMonthNameLittleEndianParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$g;
    }
    innerExtract(context, match) {
        const result = context.createParsingResult(match.index, match[0]);
        const month = MONTH_DICTIONARY[match[MONTH_NAME_GROUP$3].toLowerCase()];
        const day = parseOrdinalNumberPattern(match[DATE_GROUP$1]);
        if (day > 31) {
            match.index = match.index + match[DATE_GROUP$1].length;
            return null;
        }
        result.start.assign("month", month);
        result.start.assign("day", day);
        if (match[YEAR_GROUP$6]) {
            const yearNumber = parseYear(match[YEAR_GROUP$6]);
            result.start.assign("year", yearNumber);
        }
        else {
            const year = findYearClosestToRef(context.refDate, day, month);
            result.start.imply("year", year);
        }
        if (match[DATE_TO_GROUP$1]) {
            const endDate = parseOrdinalNumberPattern(match[DATE_TO_GROUP$1]);
            result.end = result.start.clone();
            result.end.assign("day", endDate);
        }
        return result;
    }
}

const PATTERN$f = new RegExp(`(${matchAnyPattern(MONTH_DICTIONARY)})` +
    "(?:-|/|\\s*,?\\s*)" +
    `(${ORDINAL_NUMBER_PATTERN})(?!\\s*(?:am|pm))\\s*` +
    "(?:" +
    "(?:to|\\-)\\s*" +
    `(${ORDINAL_NUMBER_PATTERN})\\s*` +
    ")?" +
    "(?:" +
    `(?:-|/|\\s*,\\s*|\\s+)` +
    `(${YEAR_PATTERN$1})` +
    ")?" +
    "(?=\\W|$)(?!\\:\\d)", "i");
const MONTH_NAME_GROUP$2 = 1;
const DATE_GROUP = 2;
const DATE_TO_GROUP = 3;
const YEAR_GROUP$5 = 4;
class ENMonthNameMiddleEndianParser extends AbstractParserWithWordBoundaryChecking {
    shouldSkipYearLikeDate;
    constructor(shouldSkipYearLikeDate) {
        super();
        this.shouldSkipYearLikeDate = shouldSkipYearLikeDate;
    }
    innerPattern() {
        return PATTERN$f;
    }
    innerExtract(context, match) {
        const month = MONTH_DICTIONARY[match[MONTH_NAME_GROUP$2].toLowerCase()];
        const day = parseOrdinalNumberPattern(match[DATE_GROUP]);
        if (day > 31) {
            return null;
        }
        if (this.shouldSkipYearLikeDate) {
            if (!match[DATE_TO_GROUP] && !match[YEAR_GROUP$5] && match[DATE_GROUP].match(/^2[0-5]$/)) {
                return null;
            }
        }
        const components = context
            .createParsingComponents({
            day: day,
            month: month,
        })
            .addTag("parser/ENMonthNameMiddleEndianParser");
        if (match[YEAR_GROUP$5]) {
            const year = parseYear(match[YEAR_GROUP$5]);
            components.assign("year", year);
        }
        else {
            const year = findYearClosestToRef(context.refDate, day, month);
            components.imply("year", year);
        }
        if (!match[DATE_TO_GROUP]) {
            return components;
        }
        const endDate = parseOrdinalNumberPattern(match[DATE_TO_GROUP]);
        const result = context.createParsingResult(match.index, match[0]);
        result.start = components;
        result.end = components.clone();
        result.end.assign("day", endDate);
        return result;
    }
}

const PATTERN$e = new RegExp(`((?:in)\\s*)?` +
    `(${matchAnyPattern(MONTH_DICTIONARY)})` +
    `\\s*` +
    `(?:` +
    `(?:,|-|of)?\\s*(${YEAR_PATTERN$1})?` +
    ")?" +
    "(?=[^\\s\\w]|\\s+[^0-9]|\\s+$|$)", "i");
const PREFIX_GROUP$1 = 1;
const MONTH_NAME_GROUP$1 = 2;
const YEAR_GROUP$4 = 3;
class ENMonthNameParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$e;
    }
    innerExtract(context, match) {
        const monthName = match[MONTH_NAME_GROUP$1].toLowerCase();
        if (match[0].length <= 3 && !FULL_MONTH_NAME_DICTIONARY[monthName]) {
            return null;
        }
        const result = context.createParsingResult(match.index + (match[PREFIX_GROUP$1] || "").length, match.index + match[0].length);
        result.start.imply("day", 1);
        result.start.addTag("parser/ENMonthNameParser");
        const month = MONTH_DICTIONARY[monthName];
        result.start.assign("month", month);
        if (match[YEAR_GROUP$4]) {
            const year = parseYear(match[YEAR_GROUP$4]);
            result.start.assign("year", year);
        }
        else {
            const year = findYearClosestToRef(context.refDate, 1, month);
            result.start.imply("year", year);
        }
        return result;
    }
}

const PATTERN$d = new RegExp(`([0-9]{4})[-\\.\\/\\s]` +
    `(?:(${matchAnyPattern(MONTH_DICTIONARY)})|([0-9]{1,2}))[-\\.\\/\\s]` +
    `([0-9]{1,2})` +
    "(?=\\W|$)", "i");
const YEAR_NUMBER_GROUP$1 = 1;
const MONTH_NAME_GROUP = 2;
const MONTH_NUMBER_GROUP$1 = 3;
const DATE_NUMBER_GROUP$1 = 4;
class ENYearMonthDayParser extends AbstractParserWithWordBoundaryChecking {
    strictMonthDateOrder;
    constructor(strictMonthDateOrder) {
        super();
        this.strictMonthDateOrder = strictMonthDateOrder;
    }
    innerPattern() {
        return PATTERN$d;
    }
    innerExtract(context, match) {
        const year = parseInt(match[YEAR_NUMBER_GROUP$1]);
        let day = parseInt(match[DATE_NUMBER_GROUP$1]);
        let month = match[MONTH_NUMBER_GROUP$1]
            ? parseInt(match[MONTH_NUMBER_GROUP$1])
            : MONTH_DICTIONARY[match[MONTH_NAME_GROUP].toLowerCase()];
        if (month < 1 || month > 12) {
            if (this.strictMonthDateOrder) {
                return null;
            }
            if (day >= 1 && day <= 12) {
                [month, day] = [day, month];
            }
        }
        if (day < 1 || day > 31) {
            return null;
        }
        return {
            day: day,
            month: month,
            year: year,
        };
    }
}

const PATTERN$c = new RegExp("([0-9]|0[1-9]|1[012])/([0-9]{4})" + "", "i");
const MONTH_GROUP$1 = 1;
const YEAR_GROUP$3 = 2;
class ENSlashMonthFormatParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$c;
    }
    innerExtract(context, match) {
        const year = parseInt(match[YEAR_GROUP$3]);
        const month = parseInt(match[MONTH_GROUP$1]);
        return context.createParsingComponents().imply("day", 1).assign("month", month).assign("year", year);
    }
}

function primaryTimePattern(leftBoundary, primaryPrefix, primarySuffix, flags) {
    return new RegExp(`${leftBoundary}` +
        `${primaryPrefix}` +
        `(\\d{1,4})` +
        `(?:` +
        `(?:\\.|:|：)` +
        `(\\d{1,2})` +
        `(?:` +
        `(?::|：)` +
        `(\\d{2})` +
        `(?:\\.(\\d{1,6}))?` +
        `)?` +
        `)?` +
        `(?:\\s*(a\\.m\\.|p\\.m\\.|am?|pm?))?` +
        `${primarySuffix}`, flags);
}
function followingTimePatten(followingPhase, followingSuffix) {
    return new RegExp(`^(${followingPhase})` +
        `(\\d{1,4})` +
        `(?:` +
        `(?:\\.|\\:|\\：)` +
        `(\\d{1,2})` +
        `(?:` +
        `(?:\\.|\\:|\\：)` +
        `(\\d{1,2})(?:\\.(\\d{1,6}))?` +
        `)?` +
        `)?` +
        `(?:\\s*(a\\.m\\.|p\\.m\\.|am?|pm?))?` +
        `${followingSuffix}`, "i");
}
const HOUR_GROUP$1 = 2;
const MINUTE_GROUP$1 = 3;
const SECOND_GROUP$1 = 4;
const MILLI_SECOND_GROUP = 5;
const AM_PM_HOUR_GROUP$1 = 6;
class AbstractTimeExpressionParser {
    strictMode;
    constructor(strictMode = false) {
        this.strictMode = strictMode;
    }
    patternFlags() {
        return "i";
    }
    primaryPatternLeftBoundary() {
        return `(^|\\s|T|\\b)`;
    }
    primarySuffix() {
        return `(?!/)(?=\\W|$)`;
    }
    followingSuffix() {
        return `(?!/)(?=\\W|$)`;
    }
    pattern(context) {
        return this.getPrimaryTimePatternThroughCache();
    }
    extract(context, match) {
        const startComponents = this.extractPrimaryTimeComponents(context, match);
        if (!startComponents) {
            if (match[0].match(/^\d{4}/)) {
                match.index += 4;
                return null;
            }
            match.index += match[0].length;
            return null;
        }
        const index = match.index + match[1].length;
        const text = match[0].substring(match[1].length);
        const result = context.createParsingResult(index, text, startComponents);
        match.index += match[0].length;
        const remainingText = context.text.substring(match.index);
        const followingPattern = this.getFollowingTimePatternThroughCache();
        const followingMatch = followingPattern.exec(remainingText);
        if (text.match(/^\d{3,4}/) && followingMatch) {
            if (followingMatch[0].match(/^\s*([+-])\s*\d{2,4}$/)) {
                return null;
            }
            if (followingMatch[0].match(/^\s*([+-])\s*\d{2}\W\d{2}/)) {
                return null;
            }
        }
        if (!followingMatch ||
            followingMatch[0].match(/^\s*([+-])\s*\d{3,4}$/)) {
            return this.checkAndReturnWithoutFollowingPattern(result);
        }
        result.end = this.extractFollowingTimeComponents(context, followingMatch, result);
        if (result.end) {
            result.text += followingMatch[0];
        }
        return this.checkAndReturnWithFollowingPattern(result);
    }
    extractPrimaryTimeComponents(context, match, strict = false) {
        const components = context.createParsingComponents();
        let minute = 0;
        let meridiem = null;
        let hour = parseInt(match[HOUR_GROUP$1]);
        if (hour > 100) {
            if (match[HOUR_GROUP$1].length == 4 && match[MINUTE_GROUP$1] == null && !match[AM_PM_HOUR_GROUP$1]) {
                return null;
            }
            if (this.strictMode || match[MINUTE_GROUP$1] != null) {
                return null;
            }
            minute = hour % 100;
            hour = Math.floor(hour / 100);
        }
        if (hour > 24) {
            return null;
        }
        if (match[MINUTE_GROUP$1] != null) {
            if (match[MINUTE_GROUP$1].length == 1 && !match[AM_PM_HOUR_GROUP$1]) {
                return null;
            }
            minute = parseInt(match[MINUTE_GROUP$1]);
        }
        if (minute >= 60) {
            return null;
        }
        if (hour > 12) {
            meridiem = Meridiem.PM;
        }
        if (match[AM_PM_HOUR_GROUP$1] != null) {
            if (hour > 12)
                return null;
            const ampm = match[AM_PM_HOUR_GROUP$1][0].toLowerCase();
            if (ampm == "a") {
                meridiem = Meridiem.AM;
                if (hour == 12) {
                    hour = 0;
                }
            }
            if (ampm == "p") {
                meridiem = Meridiem.PM;
                if (hour != 12) {
                    hour += 12;
                }
            }
        }
        components.assign("hour", hour);
        components.assign("minute", minute);
        if (meridiem !== null) {
            components.assign("meridiem", meridiem);
        }
        else {
            if (hour < 12) {
                components.imply("meridiem", Meridiem.AM);
            }
            else {
                components.imply("meridiem", Meridiem.PM);
            }
        }
        if (match[MILLI_SECOND_GROUP] != null) {
            const millisecond = parseInt(match[MILLI_SECOND_GROUP].substring(0, 3));
            if (millisecond >= 1000)
                return null;
            components.assign("millisecond", millisecond);
        }
        if (match[SECOND_GROUP$1] != null) {
            const second = parseInt(match[SECOND_GROUP$1]);
            if (second >= 60)
                return null;
            components.assign("second", second);
        }
        return components;
    }
    extractFollowingTimeComponents(context, match, result) {
        const components = context.createParsingComponents();
        if (match[MILLI_SECOND_GROUP] != null) {
            const millisecond = parseInt(match[MILLI_SECOND_GROUP].substring(0, 3));
            if (millisecond >= 1000)
                return null;
            components.assign("millisecond", millisecond);
        }
        if (match[SECOND_GROUP$1] != null) {
            const second = parseInt(match[SECOND_GROUP$1]);
            if (second >= 60)
                return null;
            components.assign("second", second);
        }
        let hour = parseInt(match[HOUR_GROUP$1]);
        let minute = 0;
        let meridiem = -1;
        if (match[MINUTE_GROUP$1] != null) {
            minute = parseInt(match[MINUTE_GROUP$1]);
        }
        else if (hour > 100) {
            minute = hour % 100;
            hour = Math.floor(hour / 100);
        }
        if (minute >= 60 || hour > 24) {
            return null;
        }
        if (hour >= 12) {
            meridiem = Meridiem.PM;
        }
        if (match[AM_PM_HOUR_GROUP$1] != null) {
            if (hour > 12) {
                return null;
            }
            const ampm = match[AM_PM_HOUR_GROUP$1][0].toLowerCase();
            if (ampm == "a") {
                meridiem = Meridiem.AM;
                if (hour == 12) {
                    hour = 0;
                    if (!components.isCertain("day")) {
                        components.imply("day", components.get("day") + 1);
                    }
                }
            }
            if (ampm == "p") {
                meridiem = Meridiem.PM;
                if (hour != 12)
                    hour += 12;
            }
            if (!result.start.isCertain("meridiem")) {
                if (meridiem == Meridiem.AM) {
                    result.start.imply("meridiem", Meridiem.AM);
                    if (result.start.get("hour") == 12) {
                        result.start.assign("hour", 0);
                    }
                }
                else {
                    result.start.imply("meridiem", Meridiem.PM);
                    if (result.start.get("hour") != 12) {
                        result.start.assign("hour", result.start.get("hour") + 12);
                    }
                }
            }
        }
        components.assign("hour", hour);
        components.assign("minute", minute);
        if (meridiem >= 0) {
            components.assign("meridiem", meridiem);
        }
        else {
            const startAtPM = result.start.isCertain("meridiem") && result.start.get("hour") > 12;
            if (startAtPM) {
                if (result.start.get("hour") - 12 > hour) {
                    components.imply("meridiem", Meridiem.AM);
                }
                else if (hour <= 12) {
                    components.assign("hour", hour + 12);
                    components.assign("meridiem", Meridiem.PM);
                }
            }
            else if (hour > 12) {
                components.imply("meridiem", Meridiem.PM);
            }
            else if (hour <= 12) {
                components.imply("meridiem", Meridiem.AM);
            }
        }
        if (components.date().getTime() < result.start.date().getTime()) {
            components.imply("day", components.get("day") + 1);
        }
        return components;
    }
    checkAndReturnWithoutFollowingPattern(result) {
        if (result.text.match(/^\d$/)) {
            return null;
        }
        if (result.text.match(/^\d\d\d+$/)) {
            return null;
        }
        if (result.text.match(/\d[apAP]$/)) {
            return null;
        }
        const endingWithNumbers = result.text.match(/[^\d:.](\d[\d.]+)$/);
        if (endingWithNumbers) {
            const endingNumbers = endingWithNumbers[1];
            if (this.strictMode) {
                return null;
            }
            if (endingNumbers.includes(".") && !endingNumbers.match(/\d(\.\d{2})+$/)) {
                return null;
            }
            const endingNumberVal = parseInt(endingNumbers);
            if (endingNumberVal > 24) {
                return null;
            }
        }
        return result;
    }
    checkAndReturnWithFollowingPattern(result) {
        if (result.text.match(/^\d+-\d+$/)) {
            return null;
        }
        const endingWithNumbers = result.text.match(/[^\d:.](\d[\d.]+)\s*-\s*(\d[\d.]+)$/);
        if (endingWithNumbers) {
            if (this.strictMode) {
                return null;
            }
            const startingNumbers = endingWithNumbers[1];
            const endingNumbers = endingWithNumbers[2];
            if (endingNumbers.includes(".") && !endingNumbers.match(/\d(\.\d{2})+$/)) {
                return null;
            }
            const endingNumberVal = parseInt(endingNumbers);
            const startingNumberVal = parseInt(startingNumbers);
            if (endingNumberVal > 24 || startingNumberVal > 24) {
                return null;
            }
        }
        return result;
    }
    cachedPrimaryPrefix = null;
    cachedPrimarySuffix = null;
    cachedPrimaryTimePattern = null;
    getPrimaryTimePatternThroughCache() {
        const primaryPrefix = this.primaryPrefix();
        const primarySuffix = this.primarySuffix();
        if (this.cachedPrimaryPrefix === primaryPrefix && this.cachedPrimarySuffix === primarySuffix) {
            return this.cachedPrimaryTimePattern;
        }
        this.cachedPrimaryTimePattern = primaryTimePattern(this.primaryPatternLeftBoundary(), primaryPrefix, primarySuffix, this.patternFlags());
        this.cachedPrimaryPrefix = primaryPrefix;
        this.cachedPrimarySuffix = primarySuffix;
        return this.cachedPrimaryTimePattern;
    }
    cachedFollowingPhase = null;
    cachedFollowingSuffix = null;
    cachedFollowingTimePatten = null;
    getFollowingTimePatternThroughCache() {
        const followingPhase = this.followingPhase();
        const followingSuffix = this.followingSuffix();
        if (this.cachedFollowingPhase === followingPhase && this.cachedFollowingSuffix === followingSuffix) {
            return this.cachedFollowingTimePatten;
        }
        this.cachedFollowingTimePatten = followingTimePatten(followingPhase, followingSuffix);
        this.cachedFollowingPhase = followingPhase;
        this.cachedFollowingSuffix = followingSuffix;
        return this.cachedFollowingTimePatten;
    }
}

class ENTimeExpressionParser extends AbstractTimeExpressionParser {
    constructor(strictMode) {
        super(strictMode);
    }
    followingPhase() {
        return "\\s*(?:\\-|\\–|\\~|\\〜|to|until|through|till|\\?)\\s*";
    }
    primaryPrefix() {
        return "(?:(?:at|from)\\s*)??";
    }
    primarySuffix() {
        return "(?:\\s*(?:o\\W*clock|at\\s*night|in\\s*the\\s*(?:morning|afternoon)))?(?!/)(?=\\W|$)";
    }
    extractPrimaryTimeComponents(context, match) {
        const components = super.extractPrimaryTimeComponents(context, match);
        if (!components) {
            return components;
        }
        if (match[0].endsWith("night")) {
            const hour = components.get("hour");
            if (hour >= 6 && hour < 12) {
                components.assign("hour", components.get("hour") + 12);
                components.assign("meridiem", Meridiem.PM);
            }
            else if (hour < 6) {
                components.assign("meridiem", Meridiem.AM);
            }
        }
        if (match[0].endsWith("afternoon")) {
            components.assign("meridiem", Meridiem.PM);
            const hour = components.get("hour");
            if (hour >= 0 && hour <= 6) {
                components.assign("hour", components.get("hour") + 12);
            }
        }
        if (match[0].endsWith("morning")) {
            components.assign("meridiem", Meridiem.AM);
            const hour = components.get("hour");
            if (hour < 12) {
                components.assign("hour", components.get("hour"));
            }
        }
        return components.addTag("parser/ENTimeExpressionParser");
    }
    extractFollowingTimeComponents(context, match, result) {
        const followingComponents = super.extractFollowingTimeComponents(context, match, result);
        if (followingComponents) {
            followingComponents.addTag("parser/ENTimeExpressionParser");
        }
        return followingComponents;
    }
}

const PATTERN$b = new RegExp(`(${TIME_UNITS_PATTERN})\\s{0,5}(?:ago|before|earlier)(?=\\W|$)`, "i");
const STRICT_PATTERN$1 = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN})\\s{0,5}(?:ago|before|earlier)(?=\\W|$)`, "i");
class ENTimeUnitAgoFormatParser extends AbstractParserWithWordBoundaryChecking {
    strictMode;
    constructor(strictMode) {
        super();
        this.strictMode = strictMode;
    }
    innerPattern() {
        return this.strictMode ? STRICT_PATTERN$1 : PATTERN$b;
    }
    innerExtract(context, match) {
        const duration = parseDuration(match[1]);
        if (!duration) {
            return null;
        }
        return ParsingComponents.createRelativeFromReference(context.reference, reverseDuration(duration));
    }
}

const PATTERN$a = new RegExp(`(${TIME_UNITS_PATTERN})\\s{0,5}(?:later|after|from now|henceforth|forward|out)` + "(?=(?:\\W|$))", "i");
const STRICT_PATTERN = new RegExp(`(${TIME_UNITS_NO_ABBR_PATTERN})\\s{0,5}(later|after|from now)(?=\\W|$)`, "i");
const GROUP_NUM_TIMEUNITS = 1;
class ENTimeUnitLaterFormatParser extends AbstractParserWithWordBoundaryChecking {
    strictMode;
    constructor(strictMode) {
        super();
        this.strictMode = strictMode;
    }
    innerPattern() {
        return this.strictMode ? STRICT_PATTERN : PATTERN$a;
    }
    innerExtract(context, match) {
        const timeUnits = parseDuration(match[GROUP_NUM_TIMEUNITS]);
        if (!timeUnits) {
            return null;
        }
        return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
    }
}

class Filter {
    refine(context, results) {
        return results.filter((r) => this.isValid(context, r));
    }
}
class MergingRefiner {
    refine(context, results) {
        if (results.length < 2) {
            return results;
        }
        const mergedResults = [];
        let curResult = results[0];
        let nextResult = null;
        for (let i = 1; i < results.length; i++) {
            nextResult = results[i];
            const textBetween = context.text.substring(curResult.index + curResult.text.length, nextResult.index);
            if (!this.shouldMergeResults(textBetween, curResult, nextResult, context)) {
                mergedResults.push(curResult);
                curResult = nextResult;
            }
            else {
                const left = curResult;
                const right = nextResult;
                const mergedResult = this.mergeResults(textBetween, left, right, context);
                context.debug(() => {
                    console.log(`${this.constructor.name} merged ${left} and ${right} into ${mergedResult}`);
                });
                curResult = mergedResult;
            }
        }
        if (curResult != null) {
            mergedResults.push(curResult);
        }
        return mergedResults;
    }
}

class AbstractMergeDateRangeRefiner extends MergingRefiner {
    shouldMergeResults(textBetween, currentResult, nextResult) {
        return !currentResult.end && !nextResult.end && textBetween.match(this.patternBetween()) != null;
    }
    mergeResults(textBetween, fromResult, toResult) {
        if (!fromResult.start.isOnlyWeekdayComponent() && !toResult.start.isOnlyWeekdayComponent()) {
            toResult.start.getCertainComponents().forEach((key) => {
                if (!fromResult.start.isCertain(key)) {
                    fromResult.start.imply(key, toResult.start.get(key));
                }
            });
            fromResult.start.getCertainComponents().forEach((key) => {
                if (!toResult.start.isCertain(key)) {
                    toResult.start.imply(key, fromResult.start.get(key));
                }
            });
        }
        if (fromResult.start.date() > toResult.start.date()) {
            let fromDate = fromResult.start.date();
            let toDate = toResult.start.date();
            if (toResult.start.isOnlyWeekdayComponent() && addDuration(toDate, { day: 7 }) > fromDate) {
                toDate = addDuration(toDate, { day: 7 });
                toResult.start.imply("day", toDate.getDate());
                toResult.start.imply("month", toDate.getMonth() + 1);
                toResult.start.imply("year", toDate.getFullYear());
            }
            else if (fromResult.start.isOnlyWeekdayComponent() && addDuration(fromDate, { day: -7 }) < toDate) {
                fromDate = addDuration(fromDate, { day: -7 });
                fromResult.start.imply("day", fromDate.getDate());
                fromResult.start.imply("month", fromDate.getMonth() + 1);
                fromResult.start.imply("year", fromDate.getFullYear());
            }
            else if (toResult.start.isDateWithUnknownYear() && addDuration(toDate, { year: 1 }) > fromDate) {
                toDate = addDuration(toDate, { year: 1 });
                toResult.start.imply("year", toDate.getFullYear());
            }
            else if (fromResult.start.isDateWithUnknownYear() && addDuration(fromDate, { year: -1 }) < toDate) {
                fromDate = addDuration(fromDate, { year: -1 });
                fromResult.start.imply("year", fromDate.getFullYear());
            }
            else {
                [toResult, fromResult] = [fromResult, toResult];
            }
        }
        const result = fromResult.clone();
        result.start = fromResult.start;
        result.end = toResult.start;
        result.index = Math.min(fromResult.index, toResult.index);
        if (fromResult.index < toResult.index) {
            result.text = fromResult.text + textBetween + toResult.text;
        }
        else {
            result.text = toResult.text + textBetween + fromResult.text;
        }
        return result;
    }
}

class ENMergeDateRangeRefiner extends AbstractMergeDateRangeRefiner {
    patternBetween() {
        return /^\s*(to|-|–|until|through|till)\s*$/i;
    }
}

function mergeDateTimeResult(dateResult, timeResult) {
    const result = dateResult.clone();
    const beginDate = dateResult.start;
    const beginTime = timeResult.start;
    result.start = mergeDateTimeComponent(beginDate, beginTime);
    if (dateResult.end != null || timeResult.end != null) {
        const endDate = dateResult.end == null ? dateResult.start : dateResult.end;
        const endTime = timeResult.end == null ? timeResult.start : timeResult.end;
        const endDateTime = mergeDateTimeComponent(endDate, endTime);
        if (dateResult.end == null && endDateTime.date().getTime() < result.start.date().getTime()) {
            const nextDay = new Date(endDateTime.date().getTime());
            nextDay.setDate(nextDay.getDate() + 1);
            if (endDateTime.isCertain("day")) {
                assignSimilarDate(endDateTime, nextDay);
            }
            else {
                implySimilarDate(endDateTime, nextDay);
            }
        }
        result.end = endDateTime;
    }
    return result;
}
function mergeDateTimeComponent(dateComponent, timeComponent) {
    const dateTimeComponent = dateComponent.clone();
    if (timeComponent.isCertain("hour")) {
        dateTimeComponent.assign("hour", timeComponent.get("hour"));
        dateTimeComponent.assign("minute", timeComponent.get("minute"));
        if (timeComponent.isCertain("second")) {
            dateTimeComponent.assign("second", timeComponent.get("second"));
            if (timeComponent.isCertain("millisecond")) {
                dateTimeComponent.assign("millisecond", timeComponent.get("millisecond"));
            }
            else {
                dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
            }
        }
        else {
            dateTimeComponent.imply("second", timeComponent.get("second"));
            dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
        }
    }
    else {
        dateTimeComponent.imply("hour", timeComponent.get("hour"));
        dateTimeComponent.imply("minute", timeComponent.get("minute"));
        dateTimeComponent.imply("second", timeComponent.get("second"));
        dateTimeComponent.imply("millisecond", timeComponent.get("millisecond"));
    }
    if (timeComponent.isCertain("timezoneOffset")) {
        dateTimeComponent.assign("timezoneOffset", timeComponent.get("timezoneOffset"));
    }
    const dateHasMeaningfulMeridiem = dateComponent.get("meridiem") != null &&
        (dateComponent.isCertain("meridiem") ||
            Array.from(dateComponent.tags()).some((t) => t.startsWith("casualReference/")));
    if (timeComponent.isCertain("meridiem")) {
        dateTimeComponent.assign("meridiem", timeComponent.get("meridiem"));
    }
    else if (timeComponent.get("meridiem") != null && !dateHasMeaningfulMeridiem) {
        dateTimeComponent.imply("meridiem", timeComponent.get("meridiem"));
    }
    if (dateTimeComponent.get("meridiem") == Meridiem.PM && dateTimeComponent.get("hour") < 12) {
        if (timeComponent.isCertain("hour")) {
            dateTimeComponent.assign("hour", dateTimeComponent.get("hour") + 12);
        }
        else {
            dateTimeComponent.imply("hour", dateTimeComponent.get("hour") + 12);
        }
    }
    dateTimeComponent.addTags(dateComponent.tags());
    dateTimeComponent.addTags(timeComponent.tags());
    return dateTimeComponent;
}

class AbstractMergeDateTimeRefiner extends MergingRefiner {
    shouldMergeResults(textBetween, currentResult, nextResult) {
        return (((currentResult.start.isOnlyDate() && nextResult.start.isOnlyTime()) ||
            (nextResult.start.isOnlyDate() && currentResult.start.isOnlyTime())) &&
            textBetween.match(this.patternBetween()) != null);
    }
    mergeResults(textBetween, currentResult, nextResult) {
        const result = currentResult.start.isOnlyDate()
            ? mergeDateTimeResult(currentResult, nextResult)
            : mergeDateTimeResult(nextResult, currentResult);
        result.index = currentResult.index;
        result.text = currentResult.text + textBetween + nextResult.text;
        return result;
    }
}

class ENMergeDateTimeRefiner extends AbstractMergeDateTimeRefiner {
    patternBetween() {
        return new RegExp("^\\s*(T|at|after|before|on|of|,|-|\\.|∙|:)?\\s*$");
    }
}

const TIMEZONE_NAME_PATTERN = new RegExp("^\\s*,?\\s*\\(?([A-Z]{2,4})\\)?(?=\\W|$)", "i");
class ExtractTimezoneAbbrRefiner {
    timezoneOverrides;
    constructor(timezoneOverrides) {
        this.timezoneOverrides = timezoneOverrides;
    }
    refine(context, results) {
        const timezoneOverrides = context.option.timezones ?? {};
        results.forEach((result) => {
            const suffix = context.text.substring(result.index + result.text.length);
            const match = TIMEZONE_NAME_PATTERN.exec(suffix);
            if (!match) {
                return;
            }
            const timezoneAbbr = match[1].toUpperCase();
            const refDate = result.start.date() ?? result.refDate ?? new Date();
            const tzOverrides = { ...this.timezoneOverrides, ...timezoneOverrides };
            const extractedTimezoneOffset = toTimezoneOffset(timezoneAbbr, refDate, tzOverrides);
            if (extractedTimezoneOffset == null) {
                return;
            }
            context.debug(() => {
                console.log(`Extracting timezone: '${timezoneAbbr}' into: ${extractedTimezoneOffset} for: ${result.start}`);
            });
            const currentTimezoneOffset = result.start.get("timezoneOffset");
            if (currentTimezoneOffset !== null && extractedTimezoneOffset != currentTimezoneOffset) {
                if (result.start.isCertain("timezoneOffset")) {
                    return;
                }
                if (timezoneAbbr != match[1]) {
                    return;
                }
            }
            if (result.start.isOnlyDate()) {
                if (timezoneAbbr != match[1]) {
                    return;
                }
            }
            result.text += match[0];
            if (!result.start.isCertain("timezoneOffset")) {
                result.start.assign("timezoneOffset", extractedTimezoneOffset);
            }
            if (result.end != null && !result.end.isCertain("timezoneOffset")) {
                result.end.assign("timezoneOffset", extractedTimezoneOffset);
            }
        });
        return results;
    }
}

const TIMEZONE_OFFSET_PATTERN = new RegExp("^\\s*(?:\\(?(?:GMT|UTC)\\s?)?([+-])(\\d{1,2})(?::?(\\d{2}))?\\)?", "i");
const TIMEZONE_OFFSET_SIGN_GROUP = 1;
const TIMEZONE_OFFSET_HOUR_OFFSET_GROUP = 2;
const TIMEZONE_OFFSET_MINUTE_OFFSET_GROUP = 3;
class ExtractTimezoneOffsetRefiner {
    refine(context, results) {
        results.forEach(function (result) {
            if (result.start.isCertain("timezoneOffset")) {
                return;
            }
            const suffix = context.text.substring(result.index + result.text.length);
            const match = TIMEZONE_OFFSET_PATTERN.exec(suffix);
            if (!match) {
                return;
            }
            context.debug(() => {
                console.log(`Extracting timezone: '${match[0]}' into : ${result}`);
            });
            const hourOffset = parseInt(match[TIMEZONE_OFFSET_HOUR_OFFSET_GROUP]);
            const minuteOffset = parseInt(match[TIMEZONE_OFFSET_MINUTE_OFFSET_GROUP] || "0");
            let timezoneOffset = hourOffset * 60 + minuteOffset;
            if (timezoneOffset > 14 * 60) {
                return;
            }
            if (match[TIMEZONE_OFFSET_SIGN_GROUP] === "-") {
                timezoneOffset = -timezoneOffset;
            }
            if (result.end != null) {
                result.end.assign("timezoneOffset", timezoneOffset);
            }
            result.start.assign("timezoneOffset", timezoneOffset);
            result.text += match[0];
        });
        return results;
    }
}

class OverlapRemovalRefiner {
    refine(context, results) {
        if (results.length < 2) {
            return results;
        }
        const filteredResults = [];
        let prevResult = results[0];
        for (let i = 1; i < results.length; i++) {
            const result = results[i];
            if (result.index >= prevResult.index + prevResult.text.length) {
                filteredResults.push(prevResult);
                prevResult = result;
                continue;
            }
            let kept = null;
            let removed = null;
            if (result.text.length > prevResult.text.length) {
                kept = result;
                removed = prevResult;
            }
            else {
                kept = prevResult;
                removed = result;
            }
            context.debug(() => {
                console.log(`${this.constructor.name} remove ${removed} by ${kept}`);
            });
            prevResult = kept;
        }
        if (prevResult != null) {
            filteredResults.push(prevResult);
        }
        return filteredResults;
    }
}

function createParsingComponentsAtWeekday(reference, weekday, modifier) {
    const refDate = reference.getDateWithAdjustedTimezone();
    const daysToWeekday = getDaysToWeekday(refDate, weekday, modifier);
    let components = new ParsingComponents(reference);
    components = components.addDurationAsImplied({ day: daysToWeekday });
    components.assign("weekday", weekday);
    return components;
}
function getDaysToWeekday(refDate, weekday, modifier) {
    const refWeekday = refDate.getDay();
    switch (modifier) {
        case "this":
            return getDaysForwardToWeekday(refDate, weekday);
        case "last":
            return getBackwardDaysToWeekday(refDate, weekday);
        case "next":
            if (refWeekday == Weekday.SUNDAY) {
                return weekday == Weekday.SUNDAY ? 7 : weekday;
            }
            if (refWeekday == Weekday.SATURDAY) {
                if (weekday == Weekday.SATURDAY)
                    return 7;
                if (weekday == Weekday.SUNDAY)
                    return 8;
                return 1 + weekday;
            }
            if (weekday < refWeekday && weekday != Weekday.SUNDAY) {
                return getDaysForwardToWeekday(refDate, weekday);
            }
            else {
                return getDaysForwardToWeekday(refDate, weekday) + 7;
            }
    }
    return getDaysToWeekdayClosest(refDate, weekday);
}
function getDaysToWeekdayClosest(refDate, weekday) {
    const backward = getBackwardDaysToWeekday(refDate, weekday);
    const forward = getDaysForwardToWeekday(refDate, weekday);
    return forward < -backward ? forward : backward;
}
function getDaysForwardToWeekday(refDate, weekday) {
    const refWeekday = refDate.getDay();
    let forwardCount = weekday - refWeekday;
    if (forwardCount < 0) {
        forwardCount += 7;
    }
    return forwardCount;
}
function getBackwardDaysToWeekday(refDate, weekday) {
    const refWeekday = refDate.getDay();
    let backwardCount = weekday - refWeekday;
    if (backwardCount >= 0) {
        backwardCount -= 7;
    }
    return backwardCount;
}

class ForwardDateRefiner {
    refine(context, results) {
        if (!context.option.forwardDate) {
            return results;
        }
        results.forEach((result) => {
            let refDate = context.reference.getDateWithAdjustedTimezone();
            if (result.start.isOnlyTime() && context.reference.instant > result.start.date()) {
                const refDate = context.reference.getDateWithAdjustedTimezone();
                const refFollowingDay = new Date(refDate);
                refFollowingDay.setDate(refFollowingDay.getDate() + 1);
                implySimilarDate(result.start, refFollowingDay);
                context.debug(() => {
                    console.log(`${this.constructor.name} adjusted ${result} time from the ref date (${refDate}) to the following day (${refFollowingDay})`);
                });
                if (result.end && result.end.isOnlyTime()) {
                    implySimilarDate(result.end, refFollowingDay);
                    if (result.start.date() > result.end.date()) {
                        refFollowingDay.setDate(refFollowingDay.getDate() + 1);
                        implySimilarDate(result.end, refFollowingDay);
                    }
                }
            }
            if (result.start.isOnlyWeekdayComponent() && refDate > result.start.date()) {
                let daysToAdd = getDaysForwardToWeekday(refDate, result.start.get("weekday")) || 7;
                const forwardedWeekday = addDuration(refDate, { day: daysToAdd });
                implySimilarDate(result.start, forwardedWeekday);
                context.debug(() => {
                    console.log(`${this.constructor.name} adjusted ${result} weekday (${result.start})`);
                });
                if (result.end && result.start.date() > result.end.date()) {
                    let daysToAdd = getDaysForwardToWeekday(refDate, result.start.get("weekday")) || 7;
                    const forwardedWeekday = addDuration(refDate, { day: daysToAdd });
                    implySimilarDate(result.end, forwardedWeekday);
                    context.debug(() => {
                        console.log(`${this.constructor.name} adjusted ${result} weekday (${result.end})`);
                    });
                }
            }
            if (result.start.isDateWithUnknownYear() && refDate > result.start.date()) {
                for (let i = 0; i < 3 && refDate > result.start.date(); i++) {
                    result.start.imply("year", result.start.get("year") + 1);
                    context.debug(() => {
                        console.log(`${this.constructor.name} adjusted ${result} year (${result.start})`);
                    });
                    if (result.end && !result.end.isCertain("year")) {
                        result.end.imply("year", result.end.get("year") + 1);
                        context.debug(() => {
                            console.log(`${this.constructor.name} adjusted ${result} month (${result.start})`);
                        });
                    }
                }
            }
        });
        return results;
    }
}

class UnlikelyFormatFilter extends Filter {
    strictMode;
    constructor(strictMode) {
        super();
        this.strictMode = strictMode;
    }
    isValid(context, result) {
        if (result.text.replace(" ", "").match(/^\d*(\.\d*)?$/)) {
            context.debug(() => {
                console.log(`Removing unlikely result '${result.text}'`);
            });
            return false;
        }
        if (!result.start.isValidDate()) {
            context.debug(() => {
                console.log(`Removing invalid result: ${result} (${result.start})`);
            });
            return false;
        }
        if (result.end && !result.end.isValidDate()) {
            context.debug(() => {
                console.log(`Removing invalid result: ${result} (${result.end})`);
            });
            return false;
        }
        if (this.strictMode) {
            return this.isStrictModeValid(context, result);
        }
        return true;
    }
    isStrictModeValid(context, result) {
        if (result.start.isOnlyWeekdayComponent()) {
            context.debug(() => {
                console.log(`(Strict) Removing weekday only component: ${result} (${result.end})`);
            });
            return false;
        }
        return true;
    }
}

const PATTERN$9 = new RegExp("([0-9]{4})\\-([0-9]{1,2})\\-([0-9]{1,2})" +
    "(?:T" +
    "([0-9]{1,2}):([0-9]{1,2})" +
    "(?:" +
    ":([0-9]{1,2})(?:\\.(\\d{1,4}))?" +
    ")?" +
    "(" +
    "Z|([+-]\\d{2}):?(\\d{2})?" +
    ")?" +
    ")?" +
    "(?=\\W|$)", "i");
const YEAR_NUMBER_GROUP = 1;
const MONTH_NUMBER_GROUP = 2;
const DATE_NUMBER_GROUP = 3;
const HOUR_NUMBER_GROUP = 4;
const MINUTE_NUMBER_GROUP = 5;
const SECOND_NUMBER_GROUP = 6;
const MILLISECOND_NUMBER_GROUP = 7;
const TZD_GROUP = 8;
const TZD_HOUR_OFFSET_GROUP = 9;
const TZD_MINUTE_OFFSET_GROUP = 10;
class ISOFormatParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$9;
    }
    innerExtract(context, match) {
        const components = context.createParsingComponents({
            "year": parseInt(match[YEAR_NUMBER_GROUP]),
            "month": parseInt(match[MONTH_NUMBER_GROUP]),
            "day": parseInt(match[DATE_NUMBER_GROUP]),
        });
        if (match[HOUR_NUMBER_GROUP] != null) {
            components.assign("hour", parseInt(match[HOUR_NUMBER_GROUP]));
            components.assign("minute", parseInt(match[MINUTE_NUMBER_GROUP]));
            if (match[SECOND_NUMBER_GROUP] != null) {
                components.assign("second", parseInt(match[SECOND_NUMBER_GROUP]));
            }
            if (match[MILLISECOND_NUMBER_GROUP] != null) {
                components.assign("millisecond", parseInt(match[MILLISECOND_NUMBER_GROUP]));
            }
            if (match[TZD_GROUP] != null) {
                let offset = 0;
                if (match[TZD_HOUR_OFFSET_GROUP]) {
                    const hourOffset = parseInt(match[TZD_HOUR_OFFSET_GROUP]);
                    let minuteOffset = 0;
                    if (match[TZD_MINUTE_OFFSET_GROUP] != null) {
                        minuteOffset = parseInt(match[TZD_MINUTE_OFFSET_GROUP]);
                    }
                    offset = hourOffset * 60;
                    if (offset < 0) {
                        offset -= minuteOffset;
                    }
                    else {
                        offset += minuteOffset;
                    }
                }
                components.assign("timezoneOffset", offset);
            }
        }
        return components.addTag("parser/ISOFormatParser");
    }
}

class MergeWeekdayComponentRefiner extends MergingRefiner {
    mergeResults(textBetween, currentResult, nextResult) {
        const newResult = nextResult.clone();
        newResult.index = currentResult.index;
        newResult.text = currentResult.text + textBetween + newResult.text;
        newResult.start.assign("weekday", currentResult.start.get("weekday"));
        if (newResult.end) {
            newResult.end.assign("weekday", currentResult.start.get("weekday"));
        }
        return newResult;
    }
    shouldMergeResults(textBetween, currentResult, nextResult) {
        const weekdayThenNormalDate = currentResult.start.isOnlyWeekdayComponent() &&
            !currentResult.start.isCertain("hour") &&
            nextResult.start.isCertain("day");
        return weekdayThenNormalDate && textBetween.match(/^,?\s*$/) != null;
    }
}

function includeCommonConfiguration(configuration, strictMode = false) {
    configuration.parsers.unshift(new ISOFormatParser());
    configuration.refiners.unshift(new MergeWeekdayComponentRefiner());
    configuration.refiners.unshift(new ExtractTimezoneOffsetRefiner());
    configuration.refiners.unshift(new OverlapRemovalRefiner());
    configuration.refiners.push(new ExtractTimezoneAbbrRefiner());
    configuration.refiners.push(new OverlapRemovalRefiner());
    configuration.refiners.push(new ForwardDateRefiner());
    configuration.refiners.push(new UnlikelyFormatFilter(strictMode));
    return configuration;
}

function now(reference) {
    const targetDate = reference.getDateWithAdjustedTimezone();
    const component = new ParsingComponents(reference, {});
    assignSimilarDate(component, targetDate);
    assignSimilarTime(component, targetDate);
    component.assign("timezoneOffset", reference.getTimezoneOffset());
    component.addTag("casualReference/now");
    return component;
}
function today(reference) {
    const targetDate = reference.getDateWithAdjustedTimezone();
    const component = new ParsingComponents(reference, {});
    assignSimilarDate(component, targetDate);
    implySimilarTime(component, targetDate);
    component.delete("meridiem");
    component.addTag("casualReference/today");
    return component;
}
function yesterday(reference) {
    return theDayBefore(reference, 1).addTag("casualReference/yesterday");
}
function tomorrow(reference) {
    return theDayAfter(reference, 1).addTag("casualReference/tomorrow");
}
function theDayBefore(reference, numDay) {
    return theDayAfter(reference, -numDay);
}
function theDayAfter(reference, nDays) {
    const targetDate = reference.getDateWithAdjustedTimezone();
    const component = new ParsingComponents(reference, {});
    const newDate = new Date(targetDate.getTime());
    newDate.setDate(newDate.getDate() + nDays);
    assignSimilarDate(component, newDate);
    implySimilarTime(component, newDate);
    component.delete("meridiem");
    return component;
}
function tonight(reference, implyHour = 22) {
    const targetDate = reference.getDateWithAdjustedTimezone();
    const component = new ParsingComponents(reference, {});
    assignSimilarDate(component, targetDate);
    component.imply("hour", implyHour);
    component.imply("meridiem", Meridiem.PM);
    component.addTag("casualReference/tonight");
    return component;
}
function evening(reference, implyHour = 20) {
    const component = new ParsingComponents(reference, {});
    component.imply("meridiem", Meridiem.PM);
    component.imply("hour", implyHour);
    component.addTag("casualReference/evening");
    return component;
}
function midnight(reference) {
    const component = new ParsingComponents(reference, {});
    if (reference.getDateWithAdjustedTimezone().getHours() > 2) {
        component.addDurationAsImplied({ day: 1 });
    }
    component.assign("hour", 0);
    component.imply("minute", 0);
    component.imply("second", 0);
    component.imply("millisecond", 0);
    component.addTag("casualReference/midnight");
    return component;
}
function morning(reference, implyHour = 6) {
    const component = new ParsingComponents(reference, {});
    component.imply("meridiem", Meridiem.AM);
    component.imply("hour", implyHour);
    component.imply("minute", 0);
    component.imply("second", 0);
    component.imply("millisecond", 0);
    component.addTag("casualReference/morning");
    return component;
}
function afternoon(reference, implyHour = 15) {
    const component = new ParsingComponents(reference, {});
    component.imply("meridiem", Meridiem.PM);
    component.imply("hour", implyHour);
    component.imply("minute", 0);
    component.imply("second", 0);
    component.imply("millisecond", 0);
    component.addTag("casualReference/afternoon");
    return component;
}
function noon(reference) {
    const component = new ParsingComponents(reference, {});
    component.imply("meridiem", Meridiem.AM);
    component.assign("hour", 12);
    component.imply("minute", 0);
    component.imply("second", 0);
    component.imply("millisecond", 0);
    component.addTag("casualReference/noon");
    return component;
}

const PATTERN$8 = /(now|today|tonight|tomorrow|overmorrow|tmr|tmrw|yesterday|last\s*night)(?=\W|$)/i;
class ENCasualDateParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern(context) {
        return PATTERN$8;
    }
    innerExtract(context, match) {
        let targetDate = context.refDate;
        const lowerText = match[0].toLowerCase();
        let component = context.createParsingComponents();
        switch (lowerText) {
            case "now":
                component = now(context.reference);
                break;
            case "today":
                component = today(context.reference);
                break;
            case "yesterday":
                component = yesterday(context.reference);
                break;
            case "tomorrow":
            case "tmr":
            case "tmrw":
                component = tomorrow(context.reference);
                break;
            case "tonight":
                component = tonight(context.reference);
                break;
            case "overmorrow":
                component = theDayAfter(context.reference, 2);
                break;
            default:
                if (lowerText.match(/last\s*night/)) {
                    if (targetDate.getHours() > 6) {
                        const previousDay = new Date(targetDate.getTime());
                        previousDay.setDate(previousDay.getDate() - 1);
                        targetDate = previousDay;
                    }
                    assignSimilarDate(component, targetDate);
                    component.imply("hour", 0);
                }
                break;
        }
        component.addTag("parser/ENCasualDateParser");
        return component;
    }
}

const PATTERN$7 = /(?:this)?\s{0,3}(morning|afternoon|evening|night|midnight|midday|noon)(?=\W|$)/i;
class ENCasualTimeParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$7;
    }
    innerExtract(context, match) {
        let component = null;
        switch (match[1].toLowerCase()) {
            case "afternoon":
                component = afternoon(context.reference);
                break;
            case "evening":
            case "night":
                component = evening(context.reference);
                break;
            case "midnight":
                component = midnight(context.reference);
                break;
            case "morning":
                component = morning(context.reference);
                break;
            case "noon":
            case "midday":
                component = noon(context.reference);
                break;
        }
        if (component) {
            component.addTag("parser/ENCasualTimeParser");
        }
        return component;
    }
}

const PATTERN$6 = new RegExp("(?:(?:\\,|\\(|\\（)\\s*)?" +
    "(?:on\\s*?)?" +
    "(?:(this|last|past|next)\\s*)?" +
    `(${matchAnyPattern(WEEKDAY_DICTIONARY)}|weekend|weekday)` +
    "(?:\\s*(?:\\,|\\)|\\）))?" +
    "(?:\\s*(?:of\\s*)?(this|last|past|next)\\s*week)?" +
    "(?=\\W|$)", "i");
const PREFIX_GROUP = 1;
const WEEKDAY_GROUP = 2;
const POSTFIX_GROUP = 3;
class ENWeekdayParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$6;
    }
    innerExtract(context, match) {
        const prefix = match[PREFIX_GROUP];
        const postfix = match[POSTFIX_GROUP];
        let modifierWord = prefix || postfix;
        modifierWord = modifierWord || "";
        modifierWord = modifierWord.toLowerCase();
        let modifier = null;
        if (modifierWord == "last" || modifierWord == "past") {
            modifier = "last";
        }
        else if (modifierWord == "next") {
            modifier = "next";
        }
        else if (modifierWord == "this") {
            modifier = "this";
        }
        const weekday_word = match[WEEKDAY_GROUP].toLowerCase();
        let weekday;
        if (WEEKDAY_DICTIONARY[weekday_word] !== undefined) {
            weekday = WEEKDAY_DICTIONARY[weekday_word];
        }
        else if (weekday_word == "weekend") {
            weekday = modifier == "last" ? Weekday.SUNDAY : Weekday.SATURDAY;
        }
        else if (weekday_word == "weekday") {
            const refWeekday = context.reference.getDateWithAdjustedTimezone().getDay();
            if (refWeekday == Weekday.SUNDAY || refWeekday == Weekday.SATURDAY) {
                weekday = modifier == "last" ? Weekday.FRIDAY : Weekday.MONDAY;
            }
            else {
                weekday = refWeekday - 1;
                weekday = modifier == "last" ? weekday - 1 : weekday + 1;
                weekday = (weekday % 5) + 1;
            }
        }
        else {
            return null;
        }
        return createParsingComponentsAtWeekday(context.reference, weekday, modifier);
    }
}

const PATTERN$5 = new RegExp(`(this|last|past|next|after\\s*this)\\s*(${matchAnyPattern(TIME_UNIT_DICTIONARY)})(?=\\s*)` + "(?=\\W|$)", "i");
const MODIFIER_WORD_GROUP = 1;
const RELATIVE_WORD_GROUP = 2;
class ENRelativeDateFormatParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$5;
    }
    innerExtract(context, match) {
        const modifier = match[MODIFIER_WORD_GROUP].toLowerCase();
        const unitWord = match[RELATIVE_WORD_GROUP].toLowerCase();
        const timeunit = TIME_UNIT_DICTIONARY[unitWord];
        if (modifier == "next" || modifier.startsWith("after")) {
            const timeUnits = {};
            timeUnits[timeunit] = 1;
            return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
        }
        if (modifier == "last" || modifier == "past") {
            const timeUnits = {};
            timeUnits[timeunit] = -1;
            return ParsingComponents.createRelativeFromReference(context.reference, timeUnits);
        }
        const components = context.createParsingComponents();
        let date = new Date(context.reference.instant.getTime());
        if (unitWord.match(/week/i)) {
            date.setDate(date.getDate() - date.getDay());
            components.imply("day", date.getDate());
            components.imply("month", date.getMonth() + 1);
            components.imply("year", date.getFullYear());
        }
        else if (unitWord.match(/month/i)) {
            date.setDate(1);
            components.imply("day", date.getDate());
            components.assign("year", date.getFullYear());
            components.assign("month", date.getMonth() + 1);
        }
        else if (unitWord.match(/year/i)) {
            date.setDate(1);
            date.setMonth(0);
            components.imply("day", date.getDate());
            components.imply("month", date.getMonth() + 1);
            components.assign("year", date.getFullYear());
        }
        return components;
    }
}

const PATTERN$4 = new RegExp("([^\\d]|^)" +
    "([0-3]{0,1}[0-9]{1})[\\/\\.\\-]([0-3]{0,1}[0-9]{1})" +
    "(?:[\\/\\.\\-]([0-9]{4}|[0-9]{2}))?" +
    "(\\W|$)", "i");
const OPENING_GROUP = 1;
const ENDING_GROUP = 5;
const FIRST_NUMBERS_GROUP = 2;
const SECOND_NUMBERS_GROUP = 3;
const YEAR_GROUP$2 = 4;
class SlashDateFormatParser {
    groupNumberMonth;
    groupNumberDay;
    constructor(littleEndian) {
        this.groupNumberMonth = littleEndian ? SECOND_NUMBERS_GROUP : FIRST_NUMBERS_GROUP;
        this.groupNumberDay = littleEndian ? FIRST_NUMBERS_GROUP : SECOND_NUMBERS_GROUP;
    }
    pattern() {
        return PATTERN$4;
    }
    extract(context, match) {
        const index = match.index + match[OPENING_GROUP].length;
        const indexEnd = match.index + match[0].length - match[ENDING_GROUP].length;
        if (index > 0) {
            const textBefore = context.text.substring(0, index);
            if (textBefore.match("\\d/?$")) {
                return;
            }
        }
        if (indexEnd < context.text.length) {
            const textAfter = context.text.substring(indexEnd);
            if (textAfter.match("^/?\\d")) {
                return;
            }
        }
        const text = context.text.substring(index, indexEnd);
        if (text.match(/^\d\.\d$/) || text.match(/^\d\.\d{1,2}\.\d{1,2}\s*$/)) {
            return;
        }
        if (!match[YEAR_GROUP$2] && text.indexOf("/") < 0) {
            return;
        }
        const result = context.createParsingResult(index, text);
        let month = parseInt(match[this.groupNumberMonth]);
        let day = parseInt(match[this.groupNumberDay]);
        if (month < 1 || month > 12) {
            if (month > 12) {
                if (day >= 1 && day <= 12 && month <= 31) {
                    [day, month] = [month, day];
                }
                else {
                    return null;
                }
            }
        }
        if (day < 1 || day > 31) {
            return null;
        }
        result.start.assign("day", day);
        result.start.assign("month", month);
        if (match[YEAR_GROUP$2]) {
            const rawYearNumber = parseInt(match[YEAR_GROUP$2]);
            const year = findMostLikelyADYear(rawYearNumber);
            result.start.assign("year", year);
        }
        else {
            const year = findYearClosestToRef(context.refDate, day, month);
            result.start.imply("year", year);
        }
        return result.addTag("parser/SlashDateFormatParser");
    }
}

const PATTERN$3 = new RegExp(`(this|last|past|next|after|\\+|-)\\s*(${TIME_UNITS_PATTERN})(?=\\W|$)`, "i");
const PATTERN_NO_ABBR = new RegExp(`(this|last|past|next|after|\\+|-)\\s*(${TIME_UNITS_NO_ABBR_PATTERN})(?=\\W|$)`, "i");
class ENTimeUnitCasualRelativeFormatParser extends AbstractParserWithWordBoundaryChecking {
    allowAbbreviations;
    constructor(allowAbbreviations = true) {
        super();
        this.allowAbbreviations = allowAbbreviations;
    }
    innerPattern() {
        return this.allowAbbreviations ? PATTERN$3 : PATTERN_NO_ABBR;
    }
    innerExtract(context, match) {
        const prefix = match[1].toLowerCase();
        let duration = parseDuration(match[2]);
        if (!duration) {
            return null;
        }
        switch (prefix) {
            case "last":
            case "past":
            case "-":
                duration = reverseDuration(duration);
                break;
        }
        return ParsingComponents.createRelativeFromReference(context.reference, duration);
    }
}

function IsPositiveFollowingReference(result) {
    return result.text.match(/^[+-]/i) != null;
}
function IsNegativeFollowingReference(result) {
    return result.text.match(/^-/i) != null;
}
class ENMergeRelativeAfterDateRefiner extends MergingRefiner {
    shouldMergeResults(textBetween, currentResult, nextResult) {
        if (!textBetween.match(/^\s*$/i)) {
            return false;
        }
        return IsPositiveFollowingReference(nextResult) || IsNegativeFollowingReference(nextResult);
    }
    mergeResults(textBetween, currentResult, nextResult, context) {
        let timeUnits = parseDuration(nextResult.text);
        if (IsNegativeFollowingReference(nextResult)) {
            timeUnits = reverseDuration(timeUnits);
        }
        const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(currentResult.start.date()), timeUnits);
        return new ParsingResult(currentResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
    }
}

function hasImpliedEarlierReferenceDate(result) {
    return result.text.match(/\s+(before|from)$/i) != null;
}
function hasImpliedLaterReferenceDate(result) {
    return result.text.match(/\s+(after|since)$/i) != null;
}
class ENMergeRelativeFollowByDateRefiner extends MergingRefiner {
    patternBetween() {
        return /^\s*$/i;
    }
    shouldMergeResults(textBetween, currentResult, nextResult) {
        if (!textBetween.match(this.patternBetween())) {
            return false;
        }
        if (!hasImpliedEarlierReferenceDate(currentResult) && !hasImpliedLaterReferenceDate(currentResult)) {
            return false;
        }
        return !!nextResult.start.get("day") && !!nextResult.start.get("month") && !!nextResult.start.get("year");
    }
    mergeResults(textBetween, currentResult, nextResult) {
        let duration = parseDuration(currentResult.text);
        if (hasImpliedEarlierReferenceDate(currentResult)) {
            duration = reverseDuration(duration);
        }
        const components = ParsingComponents.createRelativeFromReference(ReferenceWithTimezone.fromDate(nextResult.start.date()), duration);
        return new ParsingResult(nextResult.reference, currentResult.index, `${currentResult.text}${textBetween}${nextResult.text}`, components);
    }
}

const YEAR_SUFFIX_PATTERN = new RegExp(`^\\s*(${YEAR_PATTERN$1})`, "i");
const YEAR_GROUP$1 = 1;
class ENExtractYearSuffixRefiner {
    refine(context, results) {
        results.forEach(function (result) {
            if (!result.start.isDateWithUnknownYear()) {
                return;
            }
            const suffix = context.text.substring(result.index + result.text.length);
            const match = YEAR_SUFFIX_PATTERN.exec(suffix);
            if (!match) {
                return;
            }
            if (match[0].trim().length <= 3) {
                return;
            }
            context.debug(() => {
                console.log(`Extracting year: '${match[0]}' into : ${result}`);
            });
            const year = parseYear(match[YEAR_GROUP$1]);
            if (result.end != null) {
                result.end.assign("year", year);
            }
            result.start.assign("year", year);
            result.text += match[0];
        });
        return results;
    }
}

class ENUnlikelyFormatFilter extends Filter {
    constructor() {
        super();
    }
    isValid(context, result) {
        const text = result.text.trim();
        if (text === context.text.trim()) {
            return true;
        }
        if (text.toLowerCase() === "may") {
            const textBefore = context.text.substring(0, result.index).trim();
            if (!textBefore.match(/\b(in)$/i)) {
                context.debug(() => {
                    console.log(`Removing unlikely result: ${result}`);
                });
                return false;
            }
        }
        if (text.toLowerCase().endsWith("the second")) {
            const textAfter = context.text.substring(result.index + result.text.length).trim();
            if (textAfter.length > 0) {
                context.debug(() => {
                    console.log(`Removing unlikely result: ${result}`);
                });
            }
            return false;
        }
        return true;
    }
}

class ENDefaultConfiguration {
    createCasualConfiguration(littleEndian = false) {
        const option = this.createConfiguration(false, littleEndian);
        option.parsers.push(new ENCasualDateParser());
        option.parsers.push(new ENCasualTimeParser());
        option.parsers.push(new ENMonthNameParser());
        option.parsers.push(new ENRelativeDateFormatParser());
        option.parsers.push(new ENTimeUnitCasualRelativeFormatParser());
        option.refiners.push(new ENUnlikelyFormatFilter());
        return option;
    }
    createConfiguration(strictMode = true, littleEndian = false) {
        const options = includeCommonConfiguration({
            parsers: [
                new SlashDateFormatParser(littleEndian),
                new ENTimeUnitWithinFormatParser(strictMode),
                new ENMonthNameLittleEndianParser(),
                new ENMonthNameMiddleEndianParser(littleEndian),
                new ENWeekdayParser(),
                new ENSlashMonthFormatParser(),
                new ENTimeExpressionParser(strictMode),
                new ENTimeUnitAgoFormatParser(strictMode),
                new ENTimeUnitLaterFormatParser(strictMode),
            ],
            refiners: [new ENMergeDateTimeRefiner()],
        }, strictMode);
        options.parsers.unshift(new ENYearMonthDayParser(strictMode));
        options.refiners.unshift(new ENMergeRelativeFollowByDateRefiner());
        options.refiners.unshift(new ENMergeRelativeAfterDateRefiner());
        options.refiners.unshift(new OverlapRemovalRefiner());
        options.refiners.push(new ENMergeDateTimeRefiner());
        options.refiners.push(new ENExtractYearSuffixRefiner());
        options.refiners.push(new ENMergeDateRangeRefiner());
        return options;
    }
}

class Chrono {
    parsers;
    refiners;
    defaultConfig = new ENDefaultConfiguration();
    constructor(configuration) {
        configuration = configuration || this.defaultConfig.createCasualConfiguration();
        this.parsers = [...configuration.parsers];
        this.refiners = [...configuration.refiners];
    }
    clone() {
        return new Chrono({
            parsers: [...this.parsers],
            refiners: [...this.refiners],
        });
    }
    parseDate(text, referenceDate, option) {
        const results = this.parse(text, referenceDate, option);
        return results.length > 0 ? results[0].start.date() : null;
    }
    parse(text, referenceDate, option) {
        const context = new ParsingContext(text, referenceDate, option);
        let results = [];
        this.parsers.forEach((parser) => {
            const parsedResults = Chrono.executeParser(context, parser);
            results = results.concat(parsedResults);
        });
        results.sort((a, b) => {
            return a.index - b.index;
        });
        this.refiners.forEach(function (refiner) {
            results = refiner.refine(context, results);
        });
        return results;
    }
    static executeParser(context, parser) {
        const results = [];
        const pattern = parser.pattern(context);
        const originalText = context.text;
        let remainingText = context.text;
        let match = pattern.exec(remainingText);
        while (match) {
            const index = match.index + originalText.length - remainingText.length;
            match.index = index;
            const result = parser.extract(context, match);
            if (!result) {
                remainingText = originalText.substring(match.index + 1);
                match = pattern.exec(remainingText);
                continue;
            }
            let parsedResult = null;
            if (result instanceof ParsingResult) {
                parsedResult = result;
            }
            else if (result instanceof ParsingComponents) {
                parsedResult = context.createParsingResult(match.index, match[0]);
                parsedResult.start = result;
            }
            else {
                parsedResult = context.createParsingResult(match.index, match[0], result);
            }
            const parsedIndex = parsedResult.index;
            const parsedText = parsedResult.text;
            context.debug(() => console.log(`${parser.constructor.name} extracted (at index=${parsedIndex}) '${parsedText}'`));
            results.push(parsedResult);
            remainingText = originalText.substring(parsedIndex + parsedText.length);
            match = pattern.exec(remainingText);
        }
        return results;
    }
}
class ParsingContext {
    text;
    option;
    reference;
    refDate;
    constructor(text, refDate, option) {
        this.text = text;
        this.option = option ?? {};
        this.reference = ReferenceWithTimezone.fromInput(refDate, this.option.timezones);
        this.refDate = this.reference.instant;
    }
    createParsingComponents(components) {
        if (components instanceof ParsingComponents) {
            return components;
        }
        return new ParsingComponents(this.reference, components);
    }
    createParsingResult(index, textOrEndIndex, startComponents, endComponents) {
        const text = typeof textOrEndIndex === "string" ? textOrEndIndex : this.text.substring(index, textOrEndIndex);
        const start = startComponents ? this.createParsingComponents(startComponents) : null;
        const end = endComponents ? this.createParsingComponents(endComponents) : null;
        return new ParsingResult(this.reference, index, text, start, end);
    }
    debug(block) {
        if (this.option.debug) {
            if (this.option.debug instanceof Function) {
                this.option.debug(block);
            }
            else {
                const handler = this.option.debug;
                handler.debug(block);
            }
        }
    }
}

const NUMBER = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
};
const WEEKDAY_OFFSET = {
    "天": 0,
    "日": 0,
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
};
function zhStringToNumber(text) {
    let number = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === "十") {
            number = number === 0 ? NUMBER[char] : number * NUMBER[char];
        }
        else {
            number += NUMBER[char];
        }
    }
    return number;
}
function zhStringToYear(text) {
    let string = "";
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        string = string + NUMBER[char];
    }
    return parseInt(string);
}

const YEAR_GROUP = 1;
const MONTH_GROUP = 2;
const DAY_GROUP = 3;
class ZHHansDateParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return new RegExp("(" +
            "\\d{2,4}|" +
            "[" +
            Object.keys(NUMBER).join("") +
            "]{4}|" +
            "[" +
            Object.keys(NUMBER).join("") +
            "]{2}" +
            ")?" +
            "(?:\\s*)" +
            "(?:年)?" +
            "(?:[\\s|,|，]*)" +
            "(" +
            "\\d{1,2}|" +
            "[" +
            Object.keys(NUMBER).join("") +
            "]{1,3}" +
            ")" +
            "(?:\\s*)" +
            "(?:月)" +
            "(?:\\s*)" +
            "(" +
            "\\d{1,2}|" +
            "[" +
            Object.keys(NUMBER).join("") +
            "]{1,3}" +
            ")?" +
            "(?:\\s*)" +
            "(?:日|号)?");
    }
    innerExtract(context, match) {
        const result = context.createParsingResult(match.index, match[0]);
        let month = parseInt(match[MONTH_GROUP]);
        if (isNaN(month))
            month = zhStringToNumber(match[MONTH_GROUP]);
        result.start.assign("month", month);
        if (match[DAY_GROUP]) {
            let day = parseInt(match[DAY_GROUP]);
            if (isNaN(day))
                day = zhStringToNumber(match[DAY_GROUP]);
            result.start.assign("day", day);
        }
        else {
            result.start.imply("day", context.refDate.getDate());
        }
        if (match[YEAR_GROUP]) {
            let year = parseInt(match[YEAR_GROUP]);
            if (isNaN(year))
                year = zhStringToYear(match[YEAR_GROUP]);
            result.start.assign("year", year);
        }
        else {
            result.start.imply("year", context.refDate.getFullYear());
        }
        return result;
    }
}

const PATTERN$2 = new RegExp("(\\d+|[" +
    Object.keys(NUMBER).join("") +
    "]+|半|几)(?:\\s*)" +
    "(?:个)?" +
    "(秒(?:钟)?|分钟|小时|钟|日|天|星期|礼拜|月|年)" +
    "(?:(?:之|过)?后|(?:之)?内)", "i");
const NUMBER_GROUP = 1;
const UNIT_GROUP = 2;
class ZHHansDeadlineFormatParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$2;
    }
    innerExtract(context, match) {
        const result = context.createParsingResult(match.index, match[0]);
        let number = parseInt(match[NUMBER_GROUP]);
        if (isNaN(number)) {
            number = zhStringToNumber(match[NUMBER_GROUP]);
        }
        if (isNaN(number)) {
            const string = match[NUMBER_GROUP];
            if (string === "几") {
                number = 3;
            }
            else if (string === "半") {
                number = 0.5;
            }
            else {
                return null;
            }
        }
        const duration = {};
        const unit = match[UNIT_GROUP];
        const unitAbbr = unit[0];
        if (unitAbbr.match(/[日天星礼月年]/)) {
            if (unitAbbr == "日" || unitAbbr == "天") {
                duration.day = number;
            }
            else if (unitAbbr == "星" || unitAbbr == "礼") {
                duration.week = number;
            }
            else if (unitAbbr == "月") {
                duration.month = number;
            }
            else if (unitAbbr == "年") {
                duration.year = number;
            }
            const date = addDuration(context.refDate, duration);
            result.start.assign("year", date.getFullYear());
            result.start.assign("month", date.getMonth() + 1);
            result.start.assign("day", date.getDate());
            return result;
        }
        if (unitAbbr == "秒") {
            duration.second = number;
        }
        else if (unitAbbr == "分") {
            duration.minute = number;
        }
        else if (unitAbbr == "小" || unitAbbr == "钟") {
            duration.hour = number;
        }
        const date = addDuration(context.refDate, duration);
        result.start.imply("year", date.getFullYear());
        result.start.imply("month", date.getMonth() + 1);
        result.start.imply("day", date.getDate());
        result.start.assign("hour", date.getHours());
        result.start.assign("minute", date.getMinutes());
        result.start.assign("second", date.getSeconds());
        return result;
    }
}

const PATTERN$1 = new RegExp("(?<prefix>上|下|这)(?:个)?(?:星期|礼拜|周)(?<weekday>" + Object.keys(WEEKDAY_OFFSET).join("|") + ")");
class ZHHansRelationWeekdayParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN$1;
    }
    innerExtract(context, match) {
        const result = context.createParsingResult(match.index, match[0]);
        const dayOfWeek = match.groups.weekday;
        const offset = WEEKDAY_OFFSET[dayOfWeek];
        if (offset === undefined)
            return null;
        let modifier = null;
        const prefix = match.groups.prefix;
        if (prefix == "上") {
            modifier = "last";
        }
        else if (prefix == "下") {
            modifier = "next";
        }
        else if (prefix == "这") {
            modifier = "this";
        }
        const date = new Date(context.refDate.getTime());
        let startMomentFixed = false;
        const refOffset = date.getDay();
        if (modifier == "last" || modifier == "past") {
            date.setDate(date.getDate() + (offset - 7 - refOffset));
            startMomentFixed = true;
        }
        else if (modifier == "next") {
            date.setDate(date.getDate() + (offset + 7 - refOffset));
            startMomentFixed = true;
        }
        else if (modifier == "this") {
            date.setDate(date.getDate() + (offset - refOffset));
        }
        else {
            let diff = offset - refOffset;
            if (Math.abs(diff - 7) < Math.abs(diff)) {
                diff -= 7;
            }
            if (Math.abs(diff + 7) < Math.abs(diff)) {
                diff += 7;
            }
            date.setDate(date.getDate() + diff);
        }
        result.start.assign("weekday", offset);
        if (startMomentFixed) {
            result.start.assign("day", date.getDate());
            result.start.assign("month", date.getMonth() + 1);
            result.start.assign("year", date.getFullYear());
        }
        else {
            result.start.imply("day", date.getDate());
            result.start.imply("month", date.getMonth() + 1);
            result.start.imply("year", date.getFullYear());
        }
        return result;
    }
}

const FIRST_REG_PATTERN = new RegExp("(?:从|自)?" +
    "(?:" +
    "(今|明|前|大前|后|大后|昨)(早|朝|晚)|" +
    "(上(?:午)|早(?:上)|下(?:午)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨))|" +
    "(今|明|前|大前|后|大后|昨)(?:日|天)" +
    "(?:[\\s,，]*)" +
    "(?:(上(?:午)|早(?:上)|下(?:午)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨)))?" +
    ")?" +
    "(?:[\\s,，]*)" +
    "(?:(\\d+|[" +
    Object.keys(NUMBER).join("") +
    "]+)(?:\\s*)(?:点|时|:|：)" +
    "(?:\\s*)" +
    "(\\d+|半|正|整|[" +
    Object.keys(NUMBER).join("") +
    "]+)?(?:\\s*)(?:分|:|：)?" +
    "(?:\\s*)" +
    "(\\d+|[" +
    Object.keys(NUMBER).join("") +
    "]+)?(?:\\s*)(?:秒)?)" +
    "(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
const SECOND_REG_PATTERN = new RegExp("(?:^\\s*(?:到|至|\\-|\\–|\\~|\\〜)\\s*)" +
    "(?:" +
    "(今|明|前|大前|后|大后|昨)(早|朝|晚)|" +
    "(上(?:午)|早(?:上)|下(?:午)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨))|" +
    "(今|明|前|大前|后|大后|昨)(?:日|天)" +
    "(?:[\\s,，]*)" +
    "(?:(上(?:午)|早(?:上)|下(?:午)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨)))?" +
    ")?" +
    "(?:[\\s,，]*)" +
    "(?:(\\d+|[" +
    Object.keys(NUMBER).join("") +
    "]+)(?:\\s*)(?:点|时|:|：)" +
    "(?:\\s*)" +
    "(\\d+|半|正|整|[" +
    Object.keys(NUMBER).join("") +
    "]+)?(?:\\s*)(?:分|:|：)?" +
    "(?:\\s*)" +
    "(\\d+|[" +
    Object.keys(NUMBER).join("") +
    "]+)?(?:\\s*)(?:秒)?)" +
    "(?:\\s*(A.M.|P.M.|AM?|PM?))?", "i");
const DAY_GROUP_1$1 = 1;
const ZH_AM_PM_HOUR_GROUP_1 = 2;
const ZH_AM_PM_HOUR_GROUP_2 = 3;
const DAY_GROUP_3$1 = 4;
const ZH_AM_PM_HOUR_GROUP_3 = 5;
const HOUR_GROUP = 6;
const MINUTE_GROUP = 7;
const SECOND_GROUP = 8;
const AM_PM_HOUR_GROUP = 9;
class ZHHansTimeExpressionParser extends AbstractParserWithWordBoundaryChecking {
    patternLeftBoundary() {
        return "()";
    }
    innerPattern() {
        return FIRST_REG_PATTERN;
    }
    innerExtract(context, match) {
        if (match.index > 0 && context.text[match.index - 1].match(/\w/)) {
            return null;
        }
        const result = context.createParsingResult(match.index, match[0]);
        const startMoment = new Date(context.reference.instant.getTime());
        if (match[DAY_GROUP_1$1]) {
            const day1 = match[DAY_GROUP_1$1];
            if (day1 == "明") {
                if (context.reference.instant.getHours() > 1) {
                    startMoment.setDate(startMoment.getDate() + 1);
                }
            }
            else if (day1 == "昨") {
                startMoment.setDate(startMoment.getDate() - 1);
            }
            else if (day1 == "前") {
                startMoment.setDate(startMoment.getDate() - 2);
            }
            else if (day1 == "大前") {
                startMoment.setDate(startMoment.getDate() - 3);
            }
            else if (day1 == "后") {
                startMoment.setDate(startMoment.getDate() + 2);
            }
            else if (day1 == "大后") {
                startMoment.setDate(startMoment.getDate() + 3);
            }
            result.start.assign("day", startMoment.getDate());
            result.start.assign("month", startMoment.getMonth() + 1);
            result.start.assign("year", startMoment.getFullYear());
        }
        else if (match[DAY_GROUP_3$1]) {
            const day3 = match[DAY_GROUP_3$1];
            if (day3 == "明") {
                startMoment.setDate(startMoment.getDate() + 1);
            }
            else if (day3 == "昨") {
                startMoment.setDate(startMoment.getDate() - 1);
            }
            else if (day3 == "前") {
                startMoment.setDate(startMoment.getDate() - 2);
            }
            else if (day3 == "大前") {
                startMoment.setDate(startMoment.getDate() - 3);
            }
            else if (day3 == "后") {
                startMoment.setDate(startMoment.getDate() + 2);
            }
            else if (day3 == "大后") {
                startMoment.setDate(startMoment.getDate() + 3);
            }
            result.start.assign("day", startMoment.getDate());
            result.start.assign("month", startMoment.getMonth() + 1);
            result.start.assign("year", startMoment.getFullYear());
        }
        else {
            result.start.imply("day", startMoment.getDate());
            result.start.imply("month", startMoment.getMonth() + 1);
            result.start.imply("year", startMoment.getFullYear());
        }
        let hour = 0;
        let minute = 0;
        let meridiem = -1;
        if (match[SECOND_GROUP]) {
            let second = parseInt(match[SECOND_GROUP]);
            if (isNaN(second)) {
                second = zhStringToNumber(match[SECOND_GROUP]);
            }
            if (second >= 60)
                return null;
            result.start.assign("second", second);
        }
        hour = parseInt(match[HOUR_GROUP]);
        if (isNaN(hour)) {
            hour = zhStringToNumber(match[HOUR_GROUP]);
        }
        if (match[MINUTE_GROUP]) {
            if (match[MINUTE_GROUP] == "半") {
                minute = 30;
            }
            else if (match[MINUTE_GROUP] == "正" || match[MINUTE_GROUP] == "整") {
                minute = 0;
            }
            else {
                minute = parseInt(match[MINUTE_GROUP]);
                if (isNaN(minute)) {
                    minute = zhStringToNumber(match[MINUTE_GROUP]);
                }
            }
        }
        else if (hour > 100) {
            minute = hour % 100;
            hour = Math.floor(hour / 100);
        }
        if (minute >= 60) {
            return null;
        }
        if (hour > 24) {
            return null;
        }
        if (hour >= 12) {
            meridiem = 1;
        }
        if (match[AM_PM_HOUR_GROUP]) {
            if (hour > 12)
                return null;
            const ampm = match[AM_PM_HOUR_GROUP][0].toLowerCase();
            if (ampm == "a") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            if (ampm == "p") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
        }
        else if (match[ZH_AM_PM_HOUR_GROUP_1]) {
            const zhAMPMString1 = match[ZH_AM_PM_HOUR_GROUP_1];
            const zhAMPM1 = zhAMPMString1[0];
            if (zhAMPM1 == "早") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            else if (zhAMPM1 == "晚") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
        }
        else if (match[ZH_AM_PM_HOUR_GROUP_2]) {
            const zhAMPMString2 = match[ZH_AM_PM_HOUR_GROUP_2];
            const zhAMPM2 = zhAMPMString2[0];
            if (zhAMPM2 == "上" || zhAMPM2 == "早" || zhAMPM2 == "凌") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            else if (zhAMPM2 == "下" || zhAMPM2 == "晚") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
        }
        else if (match[ZH_AM_PM_HOUR_GROUP_3]) {
            const zhAMPMString3 = match[ZH_AM_PM_HOUR_GROUP_3];
            const zhAMPM3 = zhAMPMString3[0];
            if (zhAMPM3 == "上" || zhAMPM3 == "早" || zhAMPM3 == "凌") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            else if (zhAMPM3 == "下" || zhAMPM3 == "晚") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
        }
        result.start.assign("hour", hour);
        result.start.assign("minute", minute);
        if (meridiem >= 0) {
            result.start.assign("meridiem", meridiem);
        }
        else {
            if (hour < 12) {
                result.start.imply("meridiem", 0);
            }
            else {
                result.start.imply("meridiem", 1);
            }
        }
        const secondMatch = SECOND_REG_PATTERN.exec(context.text.substring(result.index + result.text.length));
        if (!secondMatch) {
            if (result.text.match(/^\d+$/)) {
                return null;
            }
            return result;
        }
        let endMoment = new Date(startMoment.getTime());
        if (secondMatch[DAY_GROUP_1$1] || secondMatch[DAY_GROUP_3$1]) {
            endMoment = new Date(context.reference.instant.getTime());
        }
        result.end = context.createParsingComponents();
        if (secondMatch[DAY_GROUP_1$1]) {
            const day1 = secondMatch[DAY_GROUP_1$1];
            if (day1 == "明") {
                if (context.reference.instant.getHours() > 1) {
                    endMoment.setDate(endMoment.getDate() + 1);
                }
            }
            else if (day1 == "昨") {
                endMoment.setDate(endMoment.getDate() - 1);
            }
            else if (day1 == "前") {
                endMoment.setDate(endMoment.getDate() - 2);
            }
            else if (day1 == "大前") {
                endMoment.setDate(endMoment.getDate() - 3);
            }
            else if (day1 == "后") {
                endMoment.setDate(endMoment.getDate() + 2);
            }
            else if (day1 == "大后") {
                endMoment.setDate(endMoment.getDate() + 3);
            }
            result.end.assign("day", endMoment.getDate());
            result.end.assign("month", endMoment.getMonth() + 1);
            result.end.assign("year", endMoment.getFullYear());
        }
        else if (secondMatch[DAY_GROUP_3$1]) {
            const day3 = secondMatch[DAY_GROUP_3$1];
            if (day3 == "明") {
                endMoment.setDate(endMoment.getDate() + 1);
            }
            else if (day3 == "昨") {
                endMoment.setDate(endMoment.getDate() - 1);
            }
            else if (day3 == "前") {
                endMoment.setDate(endMoment.getDate() - 2);
            }
            else if (day3 == "大前") {
                endMoment.setDate(endMoment.getDate() - 3);
            }
            else if (day3 == "后") {
                endMoment.setDate(endMoment.getDate() + 2);
            }
            else if (day3 == "大后") {
                endMoment.setDate(endMoment.getDate() + 3);
            }
            result.end.assign("day", endMoment.getDate());
            result.end.assign("month", endMoment.getMonth() + 1);
            result.end.assign("year", endMoment.getFullYear());
        }
        else {
            result.end.imply("day", endMoment.getDate());
            result.end.imply("month", endMoment.getMonth() + 1);
            result.end.imply("year", endMoment.getFullYear());
        }
        hour = 0;
        minute = 0;
        meridiem = -1;
        if (secondMatch[SECOND_GROUP]) {
            let second = parseInt(secondMatch[SECOND_GROUP]);
            if (isNaN(second)) {
                second = zhStringToNumber(secondMatch[SECOND_GROUP]);
            }
            if (second >= 60)
                return null;
            result.end.assign("second", second);
        }
        hour = parseInt(secondMatch[HOUR_GROUP]);
        if (isNaN(hour)) {
            hour = zhStringToNumber(secondMatch[HOUR_GROUP]);
        }
        if (secondMatch[MINUTE_GROUP]) {
            if (secondMatch[MINUTE_GROUP] == "半") {
                minute = 30;
            }
            else if (secondMatch[MINUTE_GROUP] == "正" || secondMatch[MINUTE_GROUP] == "整") {
                minute = 0;
            }
            else {
                minute = parseInt(secondMatch[MINUTE_GROUP]);
                if (isNaN(minute)) {
                    minute = zhStringToNumber(secondMatch[MINUTE_GROUP]);
                }
            }
        }
        else if (hour > 100) {
            minute = hour % 100;
            hour = Math.floor(hour / 100);
        }
        if (minute >= 60) {
            return null;
        }
        if (hour > 24) {
            return null;
        }
        if (hour >= 12) {
            meridiem = 1;
        }
        if (secondMatch[AM_PM_HOUR_GROUP]) {
            if (hour > 12)
                return null;
            const ampm = secondMatch[AM_PM_HOUR_GROUP][0].toLowerCase();
            if (ampm == "a") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            if (ampm == "p") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
            if (!result.start.isCertain("meridiem")) {
                if (meridiem == 0) {
                    result.start.imply("meridiem", 0);
                    if (result.start.get("hour") == 12) {
                        result.start.assign("hour", 0);
                    }
                }
                else {
                    result.start.imply("meridiem", 1);
                    if (result.start.get("hour") != 12) {
                        result.start.assign("hour", result.start.get("hour") + 12);
                    }
                }
            }
        }
        else if (secondMatch[ZH_AM_PM_HOUR_GROUP_1]) {
            const zhAMPMString1 = secondMatch[ZH_AM_PM_HOUR_GROUP_1];
            const zhAMPM1 = zhAMPMString1[0];
            if (zhAMPM1 == "早") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            else if (zhAMPM1 == "晚") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
        }
        else if (secondMatch[ZH_AM_PM_HOUR_GROUP_2]) {
            const zhAMPMString2 = secondMatch[ZH_AM_PM_HOUR_GROUP_2];
            const zhAMPM2 = zhAMPMString2[0];
            if (zhAMPM2 == "上" || zhAMPM2 == "早" || zhAMPM2 == "凌") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            else if (zhAMPM2 == "下" || zhAMPM2 == "晚") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
        }
        else if (secondMatch[ZH_AM_PM_HOUR_GROUP_3]) {
            const zhAMPMString3 = secondMatch[ZH_AM_PM_HOUR_GROUP_3];
            const zhAMPM3 = zhAMPMString3[0];
            if (zhAMPM3 == "上" || zhAMPM3 == "早" || zhAMPM3 == "凌") {
                meridiem = 0;
                if (hour == 12)
                    hour = 0;
            }
            else if (zhAMPM3 == "下" || zhAMPM3 == "晚") {
                meridiem = 1;
                if (hour != 12)
                    hour += 12;
            }
        }
        result.text = result.text + secondMatch[0];
        result.end.assign("hour", hour);
        result.end.assign("minute", minute);
        if (meridiem >= 0) {
            result.end.assign("meridiem", meridiem);
        }
        else {
            const startAtPM = result.start.isCertain("meridiem") && result.start.get("meridiem") == 1;
            if (startAtPM && result.start.get("hour") > hour) {
                result.end.imply("meridiem", 0);
            }
            else if (hour > 12) {
                result.end.imply("meridiem", 1);
            }
        }
        if (result.end.date().getTime() < result.start.date().getTime()) {
            result.end.imply("day", result.end.get("day") + 1);
        }
        return result;
    }
}

const PATTERN = new RegExp("(?:星期|礼拜|周)(?<weekday>" + Object.keys(WEEKDAY_OFFSET).join("|") + ")");
class ZHHansWeekdayParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern() {
        return PATTERN;
    }
    innerExtract(context, match) {
        const result = context.createParsingResult(match.index, match[0]);
        const dayOfWeek = match.groups.weekday;
        const offset = WEEKDAY_OFFSET[dayOfWeek];
        if (offset === undefined)
            return null;
        const date = new Date(context.refDate.getTime());
        const refOffset = date.getDay();
        let diff = offset - refOffset;
        if (Math.abs(diff - 7) < Math.abs(diff)) {
            diff -= 7;
        }
        if (Math.abs(diff + 7) < Math.abs(diff)) {
            diff += 7;
        }
        date.setDate(date.getDate() + diff);
        result.start.assign("weekday", offset);
        {
            result.start.imply("day", date.getDate());
            result.start.imply("month", date.getMonth() + 1);
            result.start.imply("year", date.getFullYear());
        }
        return result;
    }
}

const NOW_GROUP = 1;
const DAY_GROUP_1 = 2;
const TIME_GROUP_1 = 3;
const TIME_GROUP_2 = 4;
const DAY_GROUP_3 = 5;
const TIME_GROUP_3 = 6;
class ZHHansCasualDateParser extends AbstractParserWithWordBoundaryChecking {
    innerPattern(context) {
        return new RegExp("(现在|立(?:刻|即)|即刻)|" +
            "(今|明|前|大前|后|大后|昨)(早|晚)|" +
            "(上(?:午)|早(?:上)|下(?:午)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨))|" +
            "(今|明|前|大前|后|大后|昨)(?:日|天)" +
            "(?:[\\s|,|，]*)" +
            "(?:(上(?:午)|早(?:上)|下(?:午)|晚(?:上)|夜(?:晚)?|中(?:午)|凌(?:晨)))?", "i");
    }
    innerExtract(context, match) {
        const index = match.index;
        const result = context.createParsingResult(index, match[0]);
        const refDate = context.refDate;
        let date = new Date(refDate.getTime());
        if (match[NOW_GROUP]) {
            result.start.imply("hour", refDate.getHours());
            result.start.imply("minute", refDate.getMinutes());
            result.start.imply("second", refDate.getSeconds());
            result.start.imply("millisecond", refDate.getMilliseconds());
        }
        else if (match[DAY_GROUP_1]) {
            const day1 = match[DAY_GROUP_1];
            const time1 = match[TIME_GROUP_1];
            if (day1 == "明") {
                if (refDate.getHours() > 1) {
                    date.setDate(date.getDate() + 1);
                }
            }
            else if (day1 == "昨") {
                date.setDate(date.getDate() - 1);
            }
            else if (day1 == "前") {
                date.setDate(date.getDate() - 2);
            }
            else if (day1 == "大前") {
                date.setDate(date.getDate() - 3);
            }
            else if (day1 == "后") {
                date.setDate(date.getDate() + 2);
            }
            else if (day1 == "大后") {
                date.setDate(date.getDate() + 3);
            }
            if (time1 == "早") {
                result.start.imply("hour", 6);
            }
            else if (time1 == "晚") {
                result.start.imply("hour", 22);
                result.start.imply("meridiem", 1);
            }
        }
        else if (match[TIME_GROUP_2]) {
            const timeString2 = match[TIME_GROUP_2];
            const time2 = timeString2[0];
            if (time2 == "早" || time2 == "上") {
                result.start.imply("hour", 6);
            }
            else if (time2 == "下") {
                result.start.imply("hour", 15);
                result.start.imply("meridiem", 1);
            }
            else if (time2 == "中") {
                result.start.imply("hour", 12);
                result.start.imply("meridiem", 1);
            }
            else if (time2 == "夜" || time2 == "晚") {
                result.start.imply("hour", 22);
                result.start.imply("meridiem", 1);
            }
            else if (time2 == "凌") {
                result.start.imply("hour", 0);
            }
        }
        else if (match[DAY_GROUP_3]) {
            const day3 = match[DAY_GROUP_3];
            if (day3 == "明") {
                if (refDate.getHours() > 1) {
                    date.setDate(date.getDate() + 1);
                }
            }
            else if (day3 == "昨") {
                date.setDate(date.getDate() - 1);
            }
            else if (day3 == "前") {
                date.setDate(date.getDate() - 2);
            }
            else if (day3 == "大前") {
                date.setDate(date.getDate() - 3);
            }
            else if (day3 == "后") {
                date.setDate(date.getDate() + 2);
            }
            else if (day3 == "大后") {
                date.setDate(date.getDate() + 3);
            }
            const timeString3 = match[TIME_GROUP_3];
            if (timeString3) {
                const time3 = timeString3[0];
                if (time3 == "早" || time3 == "上") {
                    result.start.imply("hour", 6);
                }
                else if (time3 == "下") {
                    result.start.imply("hour", 15);
                    result.start.imply("meridiem", 1);
                }
                else if (time3 == "中") {
                    result.start.imply("hour", 12);
                    result.start.imply("meridiem", 1);
                }
                else if (time3 == "夜" || time3 == "晚") {
                    result.start.imply("hour", 22);
                    result.start.imply("meridiem", 1);
                }
                else if (time3 == "凌") {
                    result.start.imply("hour", 0);
                }
            }
        }
        result.start.assign("day", date.getDate());
        result.start.assign("month", date.getMonth() + 1);
        result.start.assign("year", date.getFullYear());
        return result;
    }
}

class ZHHansMergeDateRangeRefiner extends AbstractMergeDateRangeRefiner {
    patternBetween() {
        return /^\s*(至|到|-|~|～|－|ー)\s*$/i;
    }
}

class ZHHansMergeDateTimeRefiner extends AbstractMergeDateTimeRefiner {
    patternBetween() {
        return /^\s*$/i;
    }
}

new Chrono(createCasualConfiguration());
new Chrono(createCasualConfiguration());
new Chrono(createConfiguration());
function createCasualConfiguration() {
    const option = createConfiguration();
    option.parsers.unshift(new ZHHansCasualDateParser());
    return option;
}
function createConfiguration() {
    const configuration = includeCommonConfiguration({
        parsers: [
            new ZHHansDateParser(),
            new ZHHansRelationWeekdayParser(),
            new ZHHansWeekdayParser(),
            new ZHHansTimeExpressionParser(),
            new ZHHansDeadlineFormatParser(),
        ],
        refiners: [new ZHHansMergeDateRangeRefiner(), new ZHHansMergeDateTimeRefiner()],
    });
    configuration.refiners = configuration.refiners.filter((refiner) => !(refiner instanceof ExtractTimezoneOffsetRefiner));
    return configuration;
}

function createZhChrono() {
    const zhConfig = createCasualConfiguration();
    const zhChrono = new Chrono(zhConfig);
    // Custom Parser 1: 特殊公历日期（元旦、国庆、圣诞等）
    const specialKeys = Object.keys(ZH_SPECIAL_DATES).sort((a, b) => b.length - a.length);
    if (specialKeys.length > 0) {
        const specialPattern = specialKeys.join("|");
        zhChrono.parsers.push({
            pattern: () => new RegExp(specialPattern),
            extract: (_context, match) => {
                const date = ZH_SPECIAL_DATES[match[0]];
                if (date) {
                    return { day: date.day, month: date.month };
                }
                return null;
            },
        });
    }
    // Custom Parser 2: 中文序数词「第一」「第二」... 「第三十一」
    const ordinalKeys = Object.keys(ZH_ORDINALS).sort((a, b) => b.length - a.length);
    const ordinalPattern = ordinalKeys.join("|");
    zhChrono.parsers.push({
        pattern: () => new RegExp(`第(${ordinalPattern})`),
        extract: (_context, match) => {
            const num = ZH_ORDINALS[match[1]];
            if (num !== undefined) {
                return { day: num, month: obsidian.moment().month() + 1 };
            }
            return null;
        },
    });
    // Custom Parser 3: 相对日（后天、大后天、前天、大前天）
    // chrono zh.hans 只覆盖今天/明天/昨天
    const relativeEntries = Object.entries(ZH_RELATIVE_DAYS)
        .filter(([, offset]) => offset !== 0 && offset !== 1 && offset !== -1)
        .sort((a, b) => b[0].length - a[0].length);
    if (relativeEntries.length > 0) {
        const relPattern = relativeEntries.map(([k]) => k).join("|");
        zhChrono.parsers.push({
            pattern: () => new RegExp(relPattern),
            extract: (context, match) => {
                const offset = ZH_RELATIVE_DAYS[match[0]];
                if (offset !== undefined) {
                    const refDate = context.refDate || new Date();
                    const target = new Date(refDate);
                    target.setDate(target.getDate() + offset);
                    return {
                        day: target.getDate(),
                        month: target.getMonth() + 1,
                        year: target.getFullYear(),
                    };
                }
                return null;
            },
        });
    }
    return zhChrono;
}
// 构建用于正则的模式片段
function buildPattern(words) {
    return words.sort((a, b) => b.length - a.length).join("|");
}
const THIS_PATTERN = buildPattern(ZH_THIS);
const NEXT_PATTERN = buildPattern(ZH_NEXT);
const WEEK_PATTERN = buildPattern(ZH_WEEK_WORDS);
const MONTH_PATTERN = buildPattern(ZH_MONTH_WORDS);
const YEAR_PATTERN = buildPattern(ZH_YEAR_WORDS);
const END_OF_MONTH_PATTERN = buildPattern(ZH_POSITION.endOfMonth);
const MID_OF_MONTH_PATTERN = buildPattern(ZH_POSITION.midOfMonth);
// 安全解析日期，失败时返回当前日期
function safeParseDate(parser, text, refDate, option) {
    const result = parser.parseDate(text, refDate, option);
    return result !== null && result !== void 0 ? result : new Date();
}
class NLDParser {
    constructor() {
        this.chrono = createZhChrono();
    }
    getParsedDate(selectedText, weekStartPreference) {
        var _a, _b, _c, _d, _e;
        const parser = this.chrono;
        const initialParse = parser.parse(selectedText);
        const weekdayIsCertain = (_a = initialParse[0]) === null || _a === void 0 ? void 0 : _a.start.isCertain("weekday");
        const weekStart = weekStartPreference === "locale-default"
            ? getLocaleWeekStart()
            : weekStartPreference;
        // ---- 特殊模式处理 ----
        // 「这周 / 本周 / 这个星期」→ 本周第一天
        const thisWeekRe = new RegExp(`^(?:${THIS_PATTERN})\\s*(?:${WEEK_PATTERN})$`);
        if (thisWeekRe.test(selectedText.trim())) {
            return safeParseDate(parser, `本周${weekStart}`, new Date());
        }
        // 「下周 / 下个星期」→ 下周第一天
        const nextWeekRe = new RegExp(`^(?:${NEXT_PATTERN})\\s*(?:${WEEK_PATTERN})$`);
        if (nextWeekRe.test(selectedText.trim())) {
            return safeParseDate(parser, `下周${weekStart}`, new Date(), {
                forwardDate: true,
            });
        }
        // 「下个月 / 下月」
        const nextMonthRe = new RegExp(`^(?:${NEXT_PATTERN})\\s*(?:${MONTH_PATTERN})$`);
        if (nextMonthRe.test(selectedText.trim())) {
            const thisMonth = safeParseDate(parser, "本月", new Date(), {
                forwardDate: true,
            });
            return safeParseDate(parser, selectedText, thisMonth, {
                forwardDate: true,
            });
        }
        // 「明年 / 来年」
        const nextYearRe = new RegExp(`^(?:${NEXT_PATTERN}|明)\\s*(?:${YEAR_PATTERN})$`);
        if (nextYearRe.test(selectedText.trim())) {
            const thisYear = safeParseDate(parser, "今年", new Date(), {
                forwardDate: true,
            });
            return safeParseDate(parser, selectedText, thisYear, {
                forwardDate: true,
            });
        }
        // 「月底 / 月末」→ 当月最后一天
        const endOfMonthRe = new RegExp(`(${END_OF_MONTH_PATTERN})\\s*([^\\n\\r]*)`);
        const endOfMonthMatch = selectedText.match(endOfMonthRe);
        if (endOfMonthMatch) {
            const contextStr = endOfMonthMatch[2].trim() || "本月";
            const tempDate = parser.parse(contextStr);
            const year = (_c = (_b = tempDate[0]) === null || _b === void 0 ? void 0 : _b.start.get("year")) !== null && _c !== void 0 ? _c : obsidian.moment().year();
            const month = (_e = (_d = tempDate[0]) === null || _d === void 0 ? void 0 : _d.start.get("month")) !== null && _e !== void 0 ? _e : obsidian.moment().month() + 1;
            const lastDay = getLastDayOfMonth(year, month);
            return safeParseDate(parser, `${year}-${month}-${lastDay}`, new Date(), { forwardDate: true });
        }
        // 「月中」→ 当月 15 日
        const midOfMonthRe = new RegExp(`(${MID_OF_MONTH_PATTERN})\\s*([^\\n\\r]*)`);
        const midOfMonthMatch = selectedText.match(midOfMonthRe);
        if (midOfMonthMatch) {
            const contextStr = midOfMonthMatch[2].trim() || "本月";
            return safeParseDate(parser, `${contextStr} 15日`, new Date(), {
                forwardDate: true,
            });
        }
        // 默认：交给 chrono zh.hans 解析
        const referenceDate = weekdayIsCertain
            ? obsidian.moment().weekday(0).toDate()
            : new Date();
        return safeParseDate(parser, selectedText, referenceDate);
    }
}

const DEFAULT_SETTINGS = {
    autosuggestToggleLink: true,
    autocompleteTriggerPhrase: "@",
    isAutosuggestEnabled: true,
    format: "YYYY-MM-DD",
    defaultAlias: "",
    weekStart: "locale-default",
    modalToggleLink: false,
    modalMomentFormat: "YYYY-MM-DD",
};
const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
class NLDSettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        const localizedWeekdays = window.moment.weekdays();
        const localeWeekStart = getLocaleWeekStart();
        containerEl.empty();
        new obsidian.Setting(containerEl).setName("格式").setHeading();
        new obsidian.Setting(containerEl)
            .setName("日期格式")
            .setDesc("日期的显示格式，使用 Moment.js 格式字符串")
            .addMomentFormat((text) => text
            .setDefaultFormat("YYYY-MM-DD")
            .setValue(this.plugin.settings.format)
            .onChange(async (value) => {
            this.plugin.settings.format = value || "YYYY-MM-DD";
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName("一周从周几开始")
            .setDesc("选择一周的起始日")
            .addDropdown((dropdown) => {
            dropdown.addOption("locale-default", `系统默认（${String(localeWeekStart)}）`);
            localizedWeekdays.forEach((day, i) => {
                dropdown.addOption(weekdays[i], day);
            });
            dropdown.setValue(this.plugin.settings.weekStart.toLowerCase());
            dropdown.onChange(async (value) => {
                this.plugin.settings.weekStart = value;
                await this.plugin.saveSettings();
            });
        });
        new obsidian.Setting(containerEl).setName("自动建议").setHeading();
        new obsidian.Setting(containerEl)
            .setName("启用日期自动建议")
            .setDesc(`开启后，输入 ${this.plugin.settings.autocompleteTriggerPhrase} 会触发日期建议菜单`)
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.isAutosuggestEnabled)
            .onChange(async (value) => {
            this.plugin.settings.isAutosuggestEnabled = value;
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName("触发字符")
            .setDesc("输入此字符触发自动建议")
            .addText((text) => text
            .setPlaceholder("@")
            .setValue(this.plugin.settings.autocompleteTriggerPhrase || "@")
            .onChange(async (value) => {
            this.plugin.settings.autocompleteTriggerPhrase = value.trim() || "@";
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName("日期包裹为链接")
            .setDesc("开启后，自动建议的日期会包裹在 [[wikilink]] 中")
            .addToggle((toggle) => toggle
            .setValue(this.plugin.settings.autosuggestToggleLink)
            .onChange(async (value) => {
            this.plugin.settings.autosuggestToggleLink = value;
            await this.plugin.saveSettings();
        }));
        new obsidian.Setting(containerEl)
            .setName("链接默认别名格式")
            .setDesc("创建 wiki 链接时的默认别名格式（Moment.js 格式），留空则无别名")
            .addText((text) => text
            .setPlaceholder("例如：MM月DD日")
            .setValue(this.plugin.settings.defaultAlias)
            .onChange(async (value) => {
            this.plugin.settings.defaultAlias = value || "";
            await this.plugin.saveSettings();
        }));
    }
}

class DateSuggest extends obsidian.EditorSuggest {
    constructor(app, plugin) {
        super(app);
        this.app = app;
        this.plugin = plugin;
        this.scope.register(["Shift"], "Enter", (evt) => {
            this.suggestions.useSelectedItem(evt);
            return false;
        });
        if (this.plugin.settings.autosuggestToggleLink) {
            this.setInstructions([
                { command: "Shift", purpose: "使用原始输入作为别名" },
            ]);
        }
    }
    getSuggestions(context) {
        const suggestions = this.getDateSuggestions(context);
        if (suggestions.length) {
            return suggestions;
        }
        return [{ label: context.query }];
    }
    getDateSuggestions(context, defaults = ["今天", "明天", "昨天", "后天"]) {
        const query = context.query.trim();
        // 上下文匹配：「下」→ 下周、下个月、下周一~周日
        if (/^下/.test(query)) {
            const suggestions = [
                "下周",
                "下个月",
                "下年",
                ...ZH_WEEKDAYS_SHORT.map((d) => `下${d}`),
                ...ZH_WEEKDAYS_LONG.map((d) => `下${d}`),
            ];
            return suggestions
                .map((label) => ({ label }))
                .filter((item) => item.label.startsWith(query));
        }
        // 「上」→ 上周、上个月、上周一~周日
        if (/^上/.test(query)) {
            const suggestions = [
                "上周",
                "上个月",
                "上年",
                ...ZH_WEEKDAYS_SHORT.map((d) => `上${d}`),
                ...ZH_WEEKDAYS_LONG.map((d) => `上${d}`),
            ];
            return suggestions
                .map((label) => ({ label }))
                .filter((item) => item.label.startsWith(query));
        }
        // 「这/本」→ 这周、这个月
        if (/^(这|本)/.test(query)) {
            const suggestions = ["这周", "这个月"];
            return suggestions
                .map((label) => ({ label }))
                .filter((item) => item.label.startsWith(query));
        }
        // 数字开头：N天后、N天前、N周后...
        const numMatch = query.match(/^(\d+)/);
        if (numMatch) {
            const n = numMatch[1];
            return [
                `${n}天后`,
                `${n}天前`,
                `${n}周后`,
                `${n}周前`,
                `${n}个月后`,
                `${n}个月前`,
            ]
                .map((label) => ({ label }))
                .filter((item) => item.label.startsWith(query));
        }
        // 中文数字开头：三天后、五天后...
        const zhNumMap = {
            "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
            "六": "6", "七": "7", "八": "8", "九": "9", "十": "10",
        };
        const zhNumMatch = query.match(/^([一二三四五六七八九十])/);
        if (zhNumMatch) {
            const n = zhNumMap[zhNumMatch[1]];
            if (n) {
                return [
                    `${zhNumMatch[1]}天后`,
                    `${zhNumMatch[1]}天前`,
                    `${zhNumMatch[1]}周后`,
                    `${zhNumMatch[1]}周前`,
                    `${zhNumMatch[1]}个月后`,
                    `${zhNumMatch[1]}个月前`,
                ]
                    .map((label) => ({ label }))
                    .filter((item) => item.label.startsWith(query));
            }
        }
        return defaults
            .map((label) => ({ label }))
            .filter((item) => item.label.startsWith(query));
    }
    renderSuggestion(suggestion, el) {
        el.setText(suggestion.label);
    }
    selectSuggestion(suggestion, event) {
        const context = this.context;
        if (!context)
            return;
        const { editor } = context;
        const includeAlias = event.shiftKey;
        let makeIntoLink = this.plugin.settings.autosuggestToggleLink;
        const parsedDate = this.plugin.parseDate(suggestion.label);
        let dateStr = parsedDate.formattedString;
        if (makeIntoLink) {
            const alias = includeAlias
                ? context.query || suggestion.label
                : getDateLinkAlias(this.plugin, suggestion.label, false) || suggestion.label;
            dateStr = generateMarkdownLink(this.app, dateStr, alias);
        }
        editor.replaceRange(dateStr, context.start, context.end);
        this.close();
    }
    onTrigger(cursor, editor) {
        var _a;
        if (!this.plugin.settings.isAutosuggestEnabled) {
            return null;
        }
        const triggerPhrase = this.plugin.settings.autocompleteTriggerPhrase;
        const startPos = ((_a = this.context) === null || _a === void 0 ? void 0 : _a.start) || {
            line: cursor.line,
            ch: cursor.ch - triggerPhrase.length,
        };
        if (!editor.getRange(startPos, cursor).startsWith(triggerPhrase)) {
            return null;
        }
        const precedingChar = editor.getRange({
            line: startPos.line,
            ch: startPos.ch - 1,
        }, startPos);
        // 避免在邮箱地址等场景误触发
        if (precedingChar && /[`a-zA-Z0-9]/.test(precedingChar)) {
            return null;
        }
        const query = editor
            .getRange(startPos, cursor)
            .substring(triggerPhrase.length);
        // 触发字符后紧跟空格则取消
        if (query === " ") {
            return null;
        }
        return {
            start: startPos,
            end: cursor,
            query,
        };
    }
}

function getParseCommand(plugin, mode) {
    const { workspace } = plugin.app;
    const activeView = workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!activeView) {
        return;
    }
    const editor = activeView.editor;
    const cursor = editor.getCursor();
    const selectedText = getSelectedText(editor);
    const date = plugin.parseDate(selectedText);
    if (!date.moment.isValid()) {
        editor.setCursor({
            line: cursor.line,
            ch: cursor.ch,
        });
        return;
    }
    let newStr;
    if (mode === "replace") {
        const alias = getDateLinkAlias(plugin, selectedText, false);
        newStr = alias
            ? `[[${date.formattedString}|${alias}]]`
            : `[[${date.formattedString}]]`;
    }
    else if (mode === "link") {
        newStr = `[${selectedText}](${date.formattedString})`;
    }
    else if (mode === "clean") {
        newStr = date.formattedString;
    }
    editor.replaceSelection(newStr);
    adjustCursor(editor, cursor, newStr, selectedText);
    editor.focus();
}
function insertMomentCommand(plugin, date, format) {
    const { workspace } = plugin.app;
    const activeView = workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (activeView) {
        const editor = activeView.editor;
        editor.replaceSelection(window.moment(date).format(format));
    }
}
function getCurrentDateCommand(plugin) {
    const format = plugin.settings.format;
    const date = new Date();
    insertMomentCommand(plugin, date, format);
}

class OpenDailyNoteModal extends obsidian.SuggestModal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder("输入中文日期，如：今天、下周三、3天后");
    }
    getSuggestions(query) {
        const tempSuggest = new DateSuggest(this.app, this.plugin);
        const suggestions = tempSuggest.getDateSuggestions({ query }, ["今天", "昨天", "明天"]);
        return suggestions.map((s) => s.label).length
            ? suggestions.map((s) => s.label)
            : [query];
    }
    renderSuggestion(suggestion, el) {
        el.createEl("div", { text: suggestion });
    }
    onChooseSuggestion(suggestion) {
        const parsedDate = this.plugin.parseDate(suggestion);
        const date = parsedDate.moment;
        if (!parsedDate.date || !date.isValid()) {
            new obsidian.Notice("无法解析该日期");
            return;
        }
        void getOrCreateDailyNote(date).then((note) => {
            if (note) {
                void this.app.workspace.getLeaf().openFile(note);
            }
        });
    }
}

class NaturalLanguageDates extends obsidian.Plugin {
    async onload() {
        await this.loadSettings();
        this.addCommand({
            id: "nlp-dates",
            name: "解析自然语言日期",
            callback: () => getParseCommand(this, "replace"),
        });
        this.addCommand({
            id: "nlp-dates-link",
            name: "解析自然语言日期（Markdown 链接）",
            callback: () => getParseCommand(this, "link"),
        });
        this.addCommand({
            id: "nlp-date-clean",
            name: "解析自然语言日期（纯文本）",
            callback: () => getParseCommand(this, "clean"),
        });
        this.addCommand({
            id: "nlp-today",
            name: "插入当前日期",
            callback: () => getCurrentDateCommand(this),
        });
        this.addCommand({
            id: "nlp-picker",
            name: "日期选择器",
            checkCallback: (checking) => {
                if (checking) {
                    return !!this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                }
                new DatePickerModal(this.app, this).open();
            },
        });
        this.addCommand({
            id: "nlp-open-daily-note",
            name: "用自然语言打开日记",
            callback: () => {
                const modal = new OpenDailyNoteModal(this.app, this);
                modal.open();
            },
        });
        this.addSettingTab(new NLDSettingsTab(this.app, this));
        this.registerObsidianProtocolHandler("nldates", (params) => void this.actionHandler(params));
        this.registerEditorSuggest(new DateSuggest(this.app, this));
        this.app.workspace.onLayoutReady(() => {
            this.parser = new NLDParser();
        });
    }
    onunload() {
        console.debug("卸载自然语言日期插件（中文）");
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()));
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    parse(dateString, format) {
        const date = this.parser.getParsedDate(dateString, this.settings.weekStart);
        const formattedString = getFormattedDate(date, format);
        if (formattedString === "Invalid date") {
            console.debug(`nldates 无法解析输入 "${dateString}"`);
        }
        return {
            formattedString,
            date,
            moment: window.moment(date),
        };
    }
    parseDate(dateString) {
        return this.parse(dateString, this.settings.format);
    }
    async actionHandler(params) {
        const { workspace } = this.app;
        const date = this.parseDate(params.day);
        const newPane = parseTruthy(params.newPane || "yes");
        if (date.moment.isValid()) {
            const dailyNote = await getOrCreateDailyNote(date.moment);
            if (dailyNote) {
                await workspace.getLeaf(newPane).openFile(dailyNote);
            }
        }
    }
}

module.exports = NaturalLanguageDates;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL2RhaWx5LW5vdGVzLnRzIiwic3JjL2xvY2FsZS50cyIsInNyYy91dGlscy50cyIsInNyYy9tb2RhbHMvZGF0ZS1waWNrZXIudHMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vdHlwZXMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vdXRpbHMvZGF0ZXMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vdGltZXpvbmUuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY2FsY3VsYXRpb24vZHVyYXRpb24uanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vcmVzdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS91dGlscy9wYXR0ZXJuLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NhbGN1bGF0aW9uL3llYXJzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vY29uc3RhbnRzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5UaW1lVW5pdFdpdGhpbkZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5Nb250aE5hbWVMaXR0bGVFbmRpYW5QYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTk1vbnRoTmFtZVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5ZZWFyTW9udGhEYXlQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOU2xhc2hNb250aEZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlRpbWVFeHByZXNzaW9uUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlRpbWVVbml0QWdvRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL2Fic3RyYWN0UmVmaW5lcnMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL0Fic3RyYWN0TWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcmVmaW5lcnMvRU5NZXJnZURhdGVSYW5nZVJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY2FsY3VsYXRpb24vbWVyZ2luZ0NhbGN1bGF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcmVmaW5lcnMvRU5NZXJnZURhdGVUaW1lUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcmVmaW5lcnMvRXh0cmFjdFRpbWV6b25lQWJiclJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL0V4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL092ZXJsYXBSZW1vdmFsUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jYWxjdWxhdGlvbi93ZWVrZGF5cy5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcmVmaW5lcnMvRm9yd2FyZERhdGVSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9Vbmxpa2VseUZvcm1hdEZpbHRlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcGFyc2Vycy9JU09Gb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL01lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29uZmlndXJhdGlvbnMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL2Nhc3VhbFJlZmVyZW5jZXMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOQ2FzdWFsRGF0ZVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5DYXN1YWxUaW1lUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTldlZWtkYXlQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOUmVsYXRpdmVEYXRlRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9wYXJzZXJzL1NsYXNoRGF0ZUZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5UaW1lVW5pdENhc3VhbFJlbGF0aXZlRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcmVmaW5lcnMvRU5NZXJnZVJlbGF0aXZlQWZ0ZXJEYXRlUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3JlZmluZXJzL0VOTWVyZ2VSZWxhdGl2ZUZvbGxvd0J5RGF0ZVJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9yZWZpbmVycy9FTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3JlZmluZXJzL0VOVW5saWtlbHlGb3JtYXRGaWx0ZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9jb25maWd1cmF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2Nocm9uby5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvY29uc3RhbnRzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc0RhdGVQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL3BhcnNlcnMvWkhIYW5zRGVhZGxpbmVGb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL3BhcnNlcnMvWkhIYW5zUmVsYXRpb25XZWVrZGF5UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc1RpbWVFeHByZXNzaW9uUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc1dlZWtkYXlQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL3BhcnNlcnMvWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvcmVmaW5lcnMvWkhIYW5zTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9yZWZpbmVycy9aSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvaW5kZXguanMiLCJzcmMvcGFyc2VyLnRzIiwic3JjL3NldHRpbmdzLnRzIiwic3JjL3N1Z2dlc3QvZGF0ZS1zdWdnZXN0LnRzIiwic3JjL2NvbW1hbmRzLnRzIiwic3JjL21vZGFscy9vcGVuLWRhaWx5LW5vdGUudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBub3JtYWxpemVQYXRoLCBOb3RpY2UsIFRGaWxlLCBURm9sZGVyLCBWYXVsdCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG50eXBlIE1vbWVudEluc3RhbmNlID0gUmV0dXJuVHlwZTx0eXBlb2Ygd2luZG93Lm1vbWVudD47XG5cbmludGVyZmFjZSBJRm9sZCB7XG4gIGZyb206IG51bWJlcjtcbiAgdG86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElGb2xkSW5mbyB7XG4gIGZvbGRzOiBJRm9sZFtdO1xufVxuXG5pbnRlcmZhY2UgSVBlcmlvZGljTm90ZVNldHRpbmdzIHtcbiAgZm9sZGVyPzogc3RyaW5nO1xuICBmb3JtYXQ/OiBzdHJpbmc7XG4gIHRlbXBsYXRlPzogc3RyaW5nO1xufVxuXG50eXBlIElHcmFudWxhcml0eSA9IFwiZGF5XCIgfCBcIndlZWtcIiB8IFwibW9udGhcIiB8IFwicXVhcnRlclwiIHwgXCJ5ZWFyXCI7XG5cbmNvbnN0IERFRkFVTFRfREFJTFlfTk9URV9GT1JNQVQgPSBcIllZWVktTU0tRERcIjtcblxuaW50ZXJmYWNlIEFwcFdpdGhJbnRlcm5hbHMge1xuICB2YXVsdDogVmF1bHQ7XG4gIHBsdWdpbnM6IHtcbiAgICBnZXRQbHVnaW4oaWQ6IHN0cmluZyk6IHVua25vd247XG4gIH07XG4gIGludGVybmFsUGx1Z2luczoge1xuICAgIGdldFBsdWdpbkJ5SWQoXG4gICAgICBpZDogc3RyaW5nXG4gICAgKTogeyBpbnN0YW5jZT86IHsgb3B0aW9ucz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0gfSB8IHVuZGVmaW5lZDtcbiAgfTtcbiAgZm9sZE1hbmFnZXI6IHtcbiAgICBzYXZlKGZpbGU6IFRGaWxlLCBmb2xkSW5mbzogSUZvbGRJbmZvKTogdm9pZDtcbiAgICBsb2FkKGZpbGU6IFRGaWxlKTogSUZvbGRJbmZvO1xuICB9O1xuICBtZXRhZGF0YUNhY2hlOiB7XG4gICAgZ2V0Rmlyc3RMaW5rcGF0aERlc3QobGlua3BhdGg6IHN0cmluZywgc291cmNlUGF0aDogc3RyaW5nKTogVEZpbGUgfCBudWxsO1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRBcHAoKTogQXBwV2l0aEludGVybmFscyB7XG4gIHJldHVybiAod2luZG93IGFzIGFueSkuYXBwIGFzIEFwcFdpdGhJbnRlcm5hbHM7XG59XG5cbmZ1bmN0aW9uIHNob3VsZFVzZVBlcmlvZGljTm90ZXNTZXR0aW5ncyhwZXJpb2RpY2l0eTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHBsdWdpbiA9IGdldEFwcCgpLnBsdWdpbnMuZ2V0UGx1Z2luKFwicGVyaW9kaWMtbm90ZXNcIikgYXNcbiAgICB8IHsgc2V0dGluZ3M/OiBSZWNvcmQ8c3RyaW5nLCB7IGVuYWJsZWQ/OiBib29sZWFuIH0+IH1cbiAgICB8IHVuZGVmaW5lZDtcbiAgcmV0dXJuIEJvb2xlYW4ocGx1Z2luPy5zZXR0aW5ncz8uW3BlcmlvZGljaXR5XT8uZW5hYmxlZCk7XG59XG5cbmZ1bmN0aW9uIGdldERhaWx5Tm90ZVNldHRpbmdzKCk6IElQZXJpb2RpY05vdGVTZXR0aW5ncyB7XG4gIHRyeSB7XG4gICAgY29uc3QgYXBwID0gZ2V0QXBwKCk7XG5cbiAgICBpZiAoc2hvdWxkVXNlUGVyaW9kaWNOb3Rlc1NldHRpbmdzKFwiZGFpbHlcIikpIHtcbiAgICAgIGNvbnN0IHBsdWdpbiA9IGFwcC5wbHVnaW5zLmdldFBsdWdpbihcInBlcmlvZGljLW5vdGVzXCIpIGFzXG4gICAgICAgIHwge1xuICAgICAgICAgICAgc2V0dGluZ3M/OiB7XG4gICAgICAgICAgICAgIGRhaWx5PzogeyBmb3JtYXQ/OiBzdHJpbmc7IGZvbGRlcj86IHN0cmluZzsgdGVtcGxhdGU/OiBzdHJpbmcgfTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB8IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IGRhaWx5ID0gcGx1Z2luPy5zZXR0aW5ncz8uZGFpbHkgfHwge307XG4gICAgICByZXR1cm4ge1xuICAgICAgICBmb3JtYXQ6XG4gICAgICAgICAgdHlwZW9mIGRhaWx5LmZvcm1hdCA9PT0gXCJzdHJpbmdcIlxuICAgICAgICAgICAgPyBkYWlseS5mb3JtYXRcbiAgICAgICAgICAgIDogREVGQVVMVF9EQUlMWV9OT1RFX0ZPUk1BVCxcbiAgICAgICAgZm9sZGVyOiB0eXBlb2YgZGFpbHkuZm9sZGVyID09PSBcInN0cmluZ1wiID8gZGFpbHkuZm9sZGVyLnRyaW0oKSA6IFwiXCIsXG4gICAgICAgIHRlbXBsYXRlOlxuICAgICAgICAgIHR5cGVvZiBkYWlseS50ZW1wbGF0ZSA9PT0gXCJzdHJpbmdcIiA/IGRhaWx5LnRlbXBsYXRlLnRyaW0oKSA6IFwiXCIsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHBsdWdpbiA9IGFwcC5pbnRlcm5hbFBsdWdpbnMuZ2V0UGx1Z2luQnlJZChcImRhaWx5LW5vdGVzXCIpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBwbHVnaW4/Lmluc3RhbmNlPy5vcHRpb25zIGFzXG4gICAgICB8IHsgZm9sZGVyPzogc3RyaW5nOyBmb3JtYXQ/OiBzdHJpbmc7IHRlbXBsYXRlPzogc3RyaW5nIH1cbiAgICAgIHwgdW5kZWZpbmVkO1xuICAgIHJldHVybiB7XG4gICAgICBmb3JtYXQ6XG4gICAgICAgIHR5cGVvZiBvcHRpb25zPy5mb3JtYXQgPT09IFwic3RyaW5nXCJcbiAgICAgICAgICA/IG9wdGlvbnMuZm9ybWF0XG4gICAgICAgICAgOiBERUZBVUxUX0RBSUxZX05PVEVfRk9STUFULFxuICAgICAgZm9sZGVyOiB0eXBlb2Ygb3B0aW9ucz8uZm9sZGVyID09PSBcInN0cmluZ1wiID8gb3B0aW9ucy5mb2xkZXIudHJpbSgpIDogXCJcIixcbiAgICAgIHRlbXBsYXRlOlxuICAgICAgICB0eXBlb2Ygb3B0aW9ucz8udGVtcGxhdGUgPT09IFwic3RyaW5nXCIgPyBvcHRpb25zLnRlbXBsYXRlLnRyaW0oKSA6IFwiXCIsXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS53YXJuKFwi5peg5rOV6K+75Y+W5pel6K6w6K6+572uXCIsIGVycik7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZvcm1hdDogREVGQVVMVF9EQUlMWV9OT1RFX0ZPUk1BVCxcbiAgICAgIGZvbGRlcjogXCJcIixcbiAgICAgIHRlbXBsYXRlOiBcIlwiLFxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0RGF0ZVVJRChcbiAgZGF0ZTogTW9tZW50SW5zdGFuY2UsXG4gIGdyYW51bGFyaXR5OiBJR3JhbnVsYXJpdHkgPSBcImRheVwiXG4pOiBzdHJpbmcge1xuICBjb25zdCB0cyA9IGRhdGUuY2xvbmUoKS5zdGFydE9mKGdyYW51bGFyaXR5KS5mb3JtYXQoKTtcbiAgcmV0dXJuIGAke2dyYW51bGFyaXR5fS0ke3RzfWA7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUVzY2FwZWRDaGFyYWN0ZXJzKGZvcm1hdDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGZvcm1hdC5yZXBsYWNlKC9cXFtbXlxcXV0qXFxdL2csIFwiXCIpO1xufVxuXG5mdW5jdGlvbiBpc0Zvcm1hdEFtYmlndW91cyhcbiAgZm9ybWF0OiBzdHJpbmcsXG4gIGdyYW51bGFyaXR5OiBJR3JhbnVsYXJpdHlcbik6IGJvb2xlYW4ge1xuICBpZiAoZ3JhbnVsYXJpdHkgPT09IFwid2Vla1wiKSB7XG4gICAgY29uc3QgY2xlYW5Gb3JtYXQgPSByZW1vdmVFc2NhcGVkQ2hhcmFjdGVycyhmb3JtYXQpO1xuICAgIHJldHVybiAoXG4gICAgICAvd3sxLDJ9L2kudGVzdChjbGVhbkZvcm1hdCkgJiZcbiAgICAgICgvTXsxLDR9Ly50ZXN0KGNsZWFuRm9ybWF0KSB8fCAvRHsxLDR9Ly50ZXN0KGNsZWFuRm9ybWF0KSlcbiAgICApO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0RGF0ZUZyb21GaWxlbmFtZShcbiAgZmlsZW5hbWU6IHN0cmluZyxcbiAgZ3JhbnVsYXJpdHk6IElHcmFudWxhcml0eVxuKTogTW9tZW50SW5zdGFuY2UgfCBudWxsIHtcbiAgY29uc3QgZ2V0U2V0dGluZ3M6IFJlY29yZDxJR3JhbnVsYXJpdHksICgpID0+IElQZXJpb2RpY05vdGVTZXR0aW5ncz4gPSB7XG4gICAgZGF5OiBnZXREYWlseU5vdGVTZXR0aW5ncyxcbiAgICB3ZWVrOiBnZXREYWlseU5vdGVTZXR0aW5ncyxcbiAgICBtb250aDogZ2V0RGFpbHlOb3RlU2V0dGluZ3MsXG4gICAgcXVhcnRlcjogZ2V0RGFpbHlOb3RlU2V0dGluZ3MsXG4gICAgeWVhcjogZ2V0RGFpbHlOb3RlU2V0dGluZ3MsXG4gIH07XG5cbiAgY29uc3Qgc2V0dGluZ0ZuID0gZ2V0U2V0dGluZ3NbZ3JhbnVsYXJpdHldITtcbiAgY29uc3QgZm9ybWF0U2V0dGluZyA9XG4gICAgKHNldHRpbmdGbigpLmZvcm1hdCA/PyBcIlwiKS5zcGxpdChcIi9cIikucG9wKCkgfHxcbiAgICBERUZBVUxUX0RBSUxZX05PVEVfRk9STUFUO1xuICBjb25zdCBub3RlRGF0ZSA9IHdpbmRvdy5tb21lbnQoZmlsZW5hbWUsIGZvcm1hdFNldHRpbmcsIHRydWUpO1xuXG4gIGlmICghbm90ZURhdGUuaXNWYWxpZCgpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBpZiAoaXNGb3JtYXRBbWJpZ3VvdXMoZm9ybWF0U2V0dGluZywgZ3JhbnVsYXJpdHkpKSB7XG4gICAgaWYgKGdyYW51bGFyaXR5ID09PSBcIndlZWtcIikge1xuICAgICAgY29uc3QgY2xlYW5Gb3JtYXQgPSByZW1vdmVFc2NhcGVkQ2hhcmFjdGVycyhmb3JtYXRTZXR0aW5nKTtcbiAgICAgIGlmICgvd3sxLDJ9L2kudGVzdChjbGVhbkZvcm1hdCkpIHtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5tb21lbnQoXG4gICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgZm9ybWF0U2V0dGluZy5yZXBsYWNlKC9NezEsNH0vZywgXCJcIikucmVwbGFjZSgvRHsxLDR9L2csIFwiXCIpLFxuICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGVEYXRlO1xufVxuXG5mdW5jdGlvbiBnZXREYXRlRnJvbUZpbGUoXG4gIGZpbGU6IFRGaWxlLFxuICBncmFudWxhcml0eTogSUdyYW51bGFyaXR5XG4pOiBNb21lbnRJbnN0YW5jZSB8IG51bGwge1xuICByZXR1cm4gZ2V0RGF0ZUZyb21GaWxlbmFtZShmaWxlLmJhc2VuYW1lLCBncmFudWxhcml0eSk7XG59XG5cbmZ1bmN0aW9uIGpvaW5QYXRocyguLi5zZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBzZWdtZW50IG9mIHNlZ21lbnRzKSB7XG4gICAgcGFydHMucHVzaCguLi5zZWdtZW50LnNwbGl0KFwiL1wiKSk7XG4gIH1cbiAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcbiAgICBpZiAoIXBhcnQgfHwgcGFydCA9PT0gXCIuXCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChwYXJ0KTtcbiAgfVxuICBpZiAocGFydHNbMF0gPT09IFwiXCIpIHtcbiAgICByZXN1bHQudW5zaGlmdChcIlwiKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0LmpvaW4oXCIvXCIpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVGb2xkZXJFeGlzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGRpcnMgPSBwYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLnNwbGl0KFwiL1wiKTtcbiAgZGlycy5wb3AoKTtcblxuICBpZiAoZGlycy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZGlyID0gam9pblBhdGhzKC4uLmRpcnMpO1xuICAgIGlmICghZ2V0QXBwKCkudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGRpcikpIHtcbiAgICAgIGF3YWl0IGdldEFwcCgpLnZhdWx0LmNyZWF0ZUZvbGRlcihkaXIpO1xuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXROb3RlUGF0aChcbiAgZGlyZWN0b3J5OiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmdcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGxldCBuYW1lID0gZmlsZW5hbWU7XG4gIGlmICghbmFtZS5lbmRzV2l0aChcIi5tZFwiKSkge1xuICAgIG5hbWUgKz0gXCIubWRcIjtcbiAgfVxuICBjb25zdCBwYXRoID0gbm9ybWFsaXplUGF0aChqb2luUGF0aHMoZGlyZWN0b3J5LCBuYW1lKSk7XG4gIGF3YWl0IGVuc3VyZUZvbGRlckV4aXN0cyhwYXRoKTtcbiAgcmV0dXJuIHBhdGg7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlbXBsYXRlSW5mbyh0ZW1wbGF0ZTogc3RyaW5nKTogUHJvbWlzZTxbc3RyaW5nLCBJRm9sZEluZm9dPiB7XG4gIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuICBjb25zdCB0ZW1wbGF0ZVBhdGggPSBub3JtYWxpemVQYXRoKHRlbXBsYXRlKTtcbiAgaWYgKHRlbXBsYXRlUGF0aCA9PT0gXCIvXCIpIHtcbiAgICByZXR1cm4gW1wiXCIsIHsgZm9sZHM6IFtdIH1dO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChcbiAgICAgIHRlbXBsYXRlUGF0aCxcbiAgICAgIFwiXCJcbiAgICApO1xuICAgIGlmICghdGVtcGxhdGVGaWxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCLmqKHmnb/mlofku7bmnKrmib7liLBcIik7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgYXBwLnZhdWx0LmNhY2hlZFJlYWQodGVtcGxhdGVGaWxlKTtcbiAgICBjb25zdCBmb2xkSW5mbyA9IGFwcC5mb2xkTWFuYWdlci5sb2FkKHRlbXBsYXRlRmlsZSk7XG4gICAgcmV0dXJuIFtjb250ZW50cywgZm9sZEluZm9dO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKGDor7vlj5bml6XorrDmqKHmnb/lpLHotKUgJyR7dGVtcGxhdGVQYXRofSdgLCBlcnIpO1xuICAgIG5ldyBOb3RpY2UoXCLor7vlj5bml6XorrDmqKHmnb/lpLHotKVcIik7XG4gICAgcmV0dXJuIFtcIlwiLCB7IGZvbGRzOiBbXSB9XTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlRGFpbHlOb3RlKFxuICBkYXRlOiBNb21lbnRJbnN0YW5jZVxuKTogUHJvbWlzZTxURmlsZT4ge1xuICBjb25zdCBhcHAgPSBnZXRBcHAoKTtcbiAgY29uc3QgeyB2YXVsdCB9ID0gYXBwO1xuXG4gIGNvbnN0IHsgdGVtcGxhdGUsIGZvcm1hdCwgZm9sZGVyIH0gPSBnZXREYWlseU5vdGVTZXR0aW5ncygpO1xuXG4gIGNvbnN0IFt0ZW1wbGF0ZUNvbnRlbnRzLCBmb2xkSW5mb10gPSBhd2FpdCBnZXRUZW1wbGF0ZUluZm8odGVtcGxhdGUgfHwgXCJcIik7XG4gIGNvbnN0IGZpbGVuYW1lID0gZGF0ZS5mb3JtYXQoZm9ybWF0KTtcbiAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBhd2FpdCBnZXROb3RlUGF0aChmb2xkZXIgfHwgXCJcIiwgZmlsZW5hbWUpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgY3JlYXRlZEZpbGUgPSBhd2FpdCB2YXVsdC5jcmVhdGUoXG4gICAgICBub3JtYWxpemVkUGF0aCxcbiAgICAgIHRlbXBsYXRlQ29udGVudHNcbiAgICAgICAgLnJlcGxhY2UoL3t7XFxzKmRhdGVcXHMqfX0vZ2ksIGZpbGVuYW1lKVxuICAgICAgICAucmVwbGFjZSgve3tcXHMqdGltZVxccyp9fS9naSwgd2luZG93Lm1vbWVudCgpLmZvcm1hdChcIkhIOm1tXCIpKVxuICAgICAgICAucmVwbGFjZSgve3tcXHMqdGl0bGVcXHMqfX0vZ2ksIGZpbGVuYW1lKVxuICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAve3tcXHMqKGRhdGV8dGltZSlcXHMqKChbKy1dXFxkKykoW3lxbXdkaHNdKSk/XFxzKig6Lis/KT99fS9naSxcbiAgICAgICAgICAoXG4gICAgICAgICAgICBfbWF0Y2g6IHN0cmluZyxcbiAgICAgICAgICAgIF90aW1lT3JEYXRlOiBzdHJpbmcsXG4gICAgICAgICAgICBjYWxjOiBzdHJpbmcsXG4gICAgICAgICAgICB0aW1lRGVsdGE6IHN0cmluZyxcbiAgICAgICAgICAgIHVuaXQ6IHN0cmluZyxcbiAgICAgICAgICAgIG1vbWVudEZvcm1hdDogc3RyaW5nXG4gICAgICAgICAgKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IHdpbmRvdy5tb21lbnQoKTtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnREYXRlID0gZGF0ZS5jbG9uZSgpLnNldCh7XG4gICAgICAgICAgICAgIGhvdXI6IG5vdy5nZXQoXCJob3VyXCIpLFxuICAgICAgICAgICAgICBtaW51dGU6IG5vdy5nZXQoXCJtaW51dGVcIiksXG4gICAgICAgICAgICAgIHNlY29uZDogbm93LmdldChcInNlY29uZFwiKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGNhbGMpIHtcbiAgICAgICAgICAgICAgY3VycmVudERhdGUuYWRkKHBhcnNlSW50KHRpbWVEZWx0YSwgMTApIGFzIG5ldmVyLCB1bml0IGFzIG5ldmVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1vbWVudEZvcm1hdCkge1xuICAgICAgICAgICAgICByZXR1cm4gY3VycmVudERhdGUuZm9ybWF0KG1vbWVudEZvcm1hdC5zdWJzdHJpbmcoMSkudHJpbSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50RGF0ZS5mb3JtYXQoZm9ybWF0KTtcbiAgICAgICAgICB9XG4gICAgICAgIClcbiAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgL3t7XFxzKnllc3RlcmRheVxccyp9fS9naSxcbiAgICAgICAgICBkYXRlLmNsb25lKCkuc3VidHJhY3QoMSwgXCJkYXlcIikuZm9ybWF0KGZvcm1hdClcbiAgICAgICAgKVxuICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAve3tcXHMqdG9tb3Jyb3dcXHMqfX0vZ2ksXG4gICAgICAgICAgZGF0ZS5jbG9uZSgpLmFkZCgxLCBcImRcIikuZm9ybWF0KGZvcm1hdClcbiAgICAgICAgKVxuICAgICk7XG5cbiAgICBhcHAuZm9sZE1hbmFnZXIuc2F2ZShjcmVhdGVkRmlsZSwgZm9sZEluZm8pO1xuXG4gICAgcmV0dXJuIGNyZWF0ZWRGaWxlO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKGDliJvlu7rmlofku7blpLHotKU6ICcke25vcm1hbGl6ZWRQYXRofSdgLCBlcnIpO1xuICAgIG5ldyBOb3RpY2UoXCLml6Dms5XliJvlu7rmlrDml6XorrDmlofku7ZcIik7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREYWlseU5vdGUoXG4gIGRhdGU6IE1vbWVudEluc3RhbmNlLFxuICBkYWlseU5vdGVzOiBSZWNvcmQ8c3RyaW5nLCBURmlsZT5cbik6IFRGaWxlIHwgbnVsbCB7XG4gIHJldHVybiBkYWlseU5vdGVzW2dldERhdGVVSUQoZGF0ZSwgXCJkYXlcIildID8/IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbGxEYWlseU5vdGVzKCk6IFJlY29yZDxzdHJpbmcsIFRGaWxlPiB7XG4gIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuICBjb25zdCB7IHZhdWx0IH0gPSBhcHA7XG4gIGNvbnN0IHsgZm9sZGVyIH0gPSBnZXREYWlseU5vdGVTZXR0aW5ncygpO1xuXG4gIGNvbnN0IGRhaWx5Tm90ZXNGb2xkZXIgPSB2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoXG4gICAgbm9ybWFsaXplUGF0aChmb2xkZXIgfHwgXCJcIilcbiAgKSBhcyBURm9sZGVyIHwgbnVsbDtcblxuICBpZiAoIWRhaWx5Tm90ZXNGb2xkZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCLmnKrmib7liLDml6XorrDmlofku7blpLlcIik7XG4gIH1cblxuICBjb25zdCBkYWlseU5vdGVzOiBSZWNvcmQ8c3RyaW5nLCBURmlsZT4gPSB7fTtcbiAgVmF1bHQucmVjdXJzZUNoaWxkcmVuKGRhaWx5Tm90ZXNGb2xkZXIsIChub3RlKSA9PiB7XG4gICAgaWYgKG5vdGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgY29uc3Qgbm90ZURhdGUgPSBnZXREYXRlRnJvbUZpbGUobm90ZSwgXCJkYXlcIik7XG4gICAgICBpZiAobm90ZURhdGUpIHtcbiAgICAgICAgY29uc3QgZGF0ZVN0cmluZyA9IGdldERhdGVVSUQobm90ZURhdGUsIFwiZGF5XCIpO1xuICAgICAgICBkYWlseU5vdGVzW2RhdGVTdHJpbmddID0gbm90ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkYWlseU5vdGVzO1xufVxuIiwiLyoqXG4gKiDkuK3mlofml6XmnJ/or43lupPvvJrluo/mlbDor43jgIHmmJ/mnJ/jgIHnm7jlr7nml6XmnJ/jgIHnibnmrorml6XmnJ9cbiAqL1xuXG4vLyAtLS0tIOW6j+aVsOivjSAtLS0tXG5leHBvcnQgY29uc3QgWkhfT1JESU5BTFM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFwi5LiAXCI6IDEsIFwi5LqMXCI6IDIsIFwi5LiJXCI6IDMsIFwi5ZubXCI6IDQsIFwi5LqUXCI6IDUsXG4gIFwi5YWtXCI6IDYsIFwi5LiDXCI6IDcsIFwi5YWrXCI6IDgsIFwi5LmdXCI6IDksIFwi5Y2BXCI6IDEwLFxuICBcIuWNgeS4gFwiOiAxMSwgXCLljYHkuoxcIjogMTIsIFwi5Y2B5LiJXCI6IDEzLCBcIuWNgeWbm1wiOiAxNCwgXCLljYHkupRcIjogMTUsXG4gIFwi5Y2B5YWtXCI6IDE2LCBcIuWNgeS4g1wiOiAxNywgXCLljYHlhatcIjogMTgsIFwi5Y2B5LmdXCI6IDE5LCBcIuS6jOWNgVwiOiAyMCxcbiAgXCLkuozljYHkuIBcIjogMjEsIFwi5LqM5Y2B5LqMXCI6IDIyLCBcIuS6jOWNgeS4iVwiOiAyMywgXCLkuozljYHlm5tcIjogMjQsIFwi5LqM5Y2B5LqUXCI6IDI1LFxuICBcIuS6jOWNgeWFrVwiOiAyNiwgXCLkuozljYHkuINcIjogMjcsIFwi5LqM5Y2B5YWrXCI6IDI4LCBcIuS6jOWNgeS5nVwiOiAyOSwgXCLkuInljYFcIjogMzAsXG4gIFwi5LiJ5Y2B5LiAXCI6IDMxLFxufTtcblxuLy8gLS0tLSDmmJ/mnJ8gLS0tLVxuZXhwb3J0IGNvbnN0IFpIX1dFRUtEQVlTX0xPTkcgPSBbXG4gIFwi5pif5pyf5LiAXCIsIFwi5pif5pyf5LqMXCIsIFwi5pif5pyf5LiJXCIsIFwi5pif5pyf5ZubXCIsIFwi5pif5pyf5LqUXCIsIFwi5pif5pyf5YWtXCIsIFwi5pif5pyf5pelXCIsXG5dO1xuXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWVNfU0hPUlQgPSBbXG4gIFwi5ZGo5LiAXCIsIFwi5ZGo5LqMXCIsIFwi5ZGo5LiJXCIsIFwi5ZGo5ZubXCIsIFwi5ZGo5LqUXCIsIFwi5ZGo5YWtXCIsIFwi5ZGo5pelXCIsXG5dO1xuXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWVNfQUxUID0gW1xuICBcIuekvOaLnOS4gFwiLCBcIuekvOaLnOS6jFwiLCBcIuekvOaLnOS4iVwiLCBcIuekvOaLnOWbm1wiLCBcIuekvOaLnOS6lFwiLCBcIuekvOaLnOWFrVwiLCBcIuekvOaLnOWkqVwiLFxuXTtcblxuLy8g5pif5pyf5ZCN56ewIOKGkiDluo/lj7fvvIgwPVN1bmRheSDlr7nlupQgbW9tZW5077yJXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWV9UT19OVU06IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFwi5pif5pyf5LiAXCI6IDEsIFwi5pif5pyf5LqMXCI6IDIsIFwi5pif5pyf5LiJXCI6IDMsIFwi5pif5pyf5ZubXCI6IDQsIFwi5pif5pyf5LqUXCI6IDUsIFwi5pif5pyf5YWtXCI6IDYsIFwi5pif5pyf5pelXCI6IDAsXG4gIFwi5ZGo5LiAXCI6IDEsIFwi5ZGo5LqMXCI6IDIsIFwi5ZGo5LiJXCI6IDMsIFwi5ZGo5ZubXCI6IDQsIFwi5ZGo5LqUXCI6IDUsIFwi5ZGo5YWtXCI6IDYsIFwi5ZGo5pelXCI6IDAsXG4gIFwi56S85ouc5LiAXCI6IDEsIFwi56S85ouc5LqMXCI6IDIsIFwi56S85ouc5LiJXCI6IDMsIFwi56S85ouc5ZubXCI6IDQsIFwi56S85ouc5LqUXCI6IDUsIFwi56S85ouc5YWtXCI6IDYsIFwi56S85ouc5aSpXCI6IDAsXG59O1xuXG4vLyAtLS0tIOebuOWvueaXpeacnyAtLS0tXG5leHBvcnQgY29uc3QgWkhfUkVMQVRJVkVfREFZUzogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHtcbiAgXCLku4rlpKlcIjogMCxcbiAgXCLku4rml6VcIjogMCxcbiAgXCLmmI7lpKlcIjogMSxcbiAgXCLmmI7ml6VcIjogMSxcbiAgXCLlkI7lpKlcIjogMixcbiAgXCLlvozlpKlcIjogMixcbiAgXCLlpKflkI7lpKlcIjogMyxcbiAgXCLlpKflvozlpKlcIjogMyxcbiAgXCLmmKjlpKlcIjogLTEsXG4gIFwi5pio5pelXCI6IC0xLFxuICBcIuWJjeWkqVwiOiAtMixcbiAgXCLlpKfliY3lpKlcIjogLTMsXG59O1xuXG4vLyAtLS0tIOWRqOacn+aMh+ekuuivjSAtLS0tXG5leHBvcnQgY29uc3QgWkhfVEhJUyA9IFtcIui/meS4qlwiLCBcIui/mVwiLCBcIuacrFwiXTtcbmV4cG9ydCBjb25zdCBaSF9ORVhUID0gW1wi5LiL5LiqXCIsIFwi5LiLXCIsIFwi5p2lXCJdO1xuZXhwb3J0IGNvbnN0IFpIX0xBU1QgPSBbXCLkuIrkuKpcIiwgXCLkuIpcIiwgXCLljrtcIl07XG5cbi8vIC0tLS0g5ZGo5pyf5Y2V5L2NIC0tLS1cbmV4cG9ydCBjb25zdCBaSF9XRUVLX1dPUkRTID0gW1wi5ZGoXCIsIFwi5pif5pyfXCIsIFwi56S85oucXCJdO1xuZXhwb3J0IGNvbnN0IFpIX01PTlRIX1dPUkRTID0gW1wi5pyIXCIsIFwi5pyI5Lu9XCJdO1xuZXhwb3J0IGNvbnN0IFpIX1lFQVJfV09SRFMgPSBbXCLlubRcIl07XG5cbi8vIC0tLS0g5pyI5Lu95ZCN56ewIC0tLS1cbmV4cG9ydCBjb25zdCBaSF9NT05USFM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFwi5LiA5pyIXCI6IDEsIFwi5LqM5pyIXCI6IDIsIFwi5LiJ5pyIXCI6IDMsIFwi5Zub5pyIXCI6IDQsIFwi5LqU5pyIXCI6IDUsIFwi5YWt5pyIXCI6IDYsXG4gIFwi5LiD5pyIXCI6IDcsIFwi5YWr5pyIXCI6IDgsIFwi5Lmd5pyIXCI6IDksIFwi5Y2B5pyIXCI6IDEwLCBcIuWNgeS4gOaciFwiOiAxMSwgXCLljYHkuozmnIhcIjogMTIsXG4gIFwiMeaciFwiOiAxLCBcIjLmnIhcIjogMiwgXCIz5pyIXCI6IDMsIFwiNOaciFwiOiA0LCBcIjXmnIhcIjogNSwgXCI25pyIXCI6IDYsXG4gIFwiN+aciFwiOiA3LCBcIjjmnIhcIjogOCwgXCI55pyIXCI6IDksIFwiMTDmnIhcIjogMTAsIFwiMTHmnIhcIjogMTEsIFwiMTLmnIhcIjogMTIsXG59O1xuXG4vLyAtLS0tIOeJueauiuS9jee9riAtLS0tXG5leHBvcnQgY29uc3QgWkhfUE9TSVRJT04gPSB7XG4gIGVuZE9mTW9udGg6IFtcIuaciOW6lVwiLCBcIuaciOacq1wiXSxcbiAgbWlkT2ZNb250aDogW1wi5pyI5LitXCJdLFxuICBzdGFydE9mTW9udGg6IFtcIuaciOWInVwiXSxcbiAgZW5kT2ZZZWFyOiBbXCLlubTlupVcIiwgXCLlubTmnKtcIiwgXCLlubTnu4hcIl0sXG4gIHN0YXJ0T2ZZZWFyOiBbXCLlubTliJ1cIl0sXG59O1xuXG4vLyAtLS0tIOeJueauiuWFrOWOhuaXpeacnyAtLS0tXG5leHBvcnQgY29uc3QgWkhfU1BFQ0lBTF9EQVRFUzogUmVjb3JkPHN0cmluZywgeyBtb250aDogbnVtYmVyOyBkYXk6IG51bWJlciB9PiA9IHtcbiAgXCLlhYPml6ZcIjogeyBtb250aDogMSwgZGF5OiAxIH0sXG4gIFwi5Yqz5Yqo6IqCXCI6IHsgbW9udGg6IDUsIGRheTogMSB9LFxuICBcIuS6lOS4gFwiOiB7IG1vbnRoOiA1LCBkYXk6IDEgfSxcbiAgXCLkupTlm5tcIjogeyBtb250aDogNSwgZGF5OiA0IH0sXG4gIFwi5YWt5LiAXCI6IHsgbW9udGg6IDYsIGRheTogMSB9LFxuICBcIuS4g+S4gFwiOiB7IG1vbnRoOiA3LCBkYXk6IDEgfSxcbiAgXCLlhavkuIBcIjogeyBtb250aDogOCwgZGF5OiAxIH0sXG4gIFwi5Zu95bqGXCI6IHsgbW9udGg6IDEwLCBkYXk6IDEgfSxcbiAgXCLljYHkuIBcIjogeyBtb250aDogMTAsIGRheTogMSB9LFxuICBcIuWco+ivnlwiOiB7IG1vbnRoOiAxMiwgZGF5OiAyNSB9LFxuICBcIuWco+ivnuiKglwiOiB7IG1vbnRoOiAxMiwgZGF5OiAyNSB9LFxuICBcIuW5s+WuieWknFwiOiB7IG1vbnRoOiAxMiwgZGF5OiAyNCB9LFxuICBcIuaDheS6uuiKglwiOiB7IG1vbnRoOiAyLCBkYXk6IDE0IH0sXG4gIFwi5oSa5Lq66IqCXCI6IHsgbW9udGg6IDQsIGRheTogMSB9LFxuICBcIuS4h+Wco+iKglwiOiB7IG1vbnRoOiAxMCwgZGF5OiAzMSB9LFxuICBcIuaEn+aBqeiKglwiOiB7IG1vbnRoOiAxMSwgZGF5OiAyNyB9LCAvLyDov5HkvLzvvIzlrp7pmYXmmK8xMeaciOesrOWbm+S4quWRqOWbm1xuICBcIumZpOWklVwiOiB7IG1vbnRoOiAxLCBkYXk6IDI4IH0sIC8vIOWGnOWOhu+8jOS7heS9nOi/keS8vFxuICBcIuWFg+WutVwiOiB7IG1vbnRoOiAyLCBkYXk6IDEyIH0sIC8vIOWGnOWOhu+8jOS7heS9nOi/keS8vFxuICBcIuerr+WNiFwiOiB7IG1vbnRoOiA2LCBkYXk6IDEgfSwgLy8g5Yac5Y6G77yM5LuF5L2c6L+R5Ly8XG4gIFwi5Lit56eLXCI6IHsgbW9udGg6IDksIGRheTogMTUgfSwgLy8g5Yac5Y6G77yM5LuF5L2c6L+R5Ly8XG4gIFwi6YeN6ZizXCI6IHsgbW9udGg6IDEwLCBkYXk6IDkgfSwgLy8g5Yac5Y6G77yM5LuF5L2c6L+R5Ly8XG4gIFwi5LiD5aSVXCI6IHsgbW9udGg6IDgsIGRheTogNCB9LCAvLyDlhpzljobvvIzku4XkvZzov5HkvLxcbn07XG5cbi8vIC0tLS0g5pWw6YeP5Y2V5L2N77yI55So5LqOIFjlpKnliY0v5ZCOIOexu+Wei++8iS0tLS1cbmV4cG9ydCBjb25zdCBaSF9OVU1CRVJfVU5JVFM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFwi5aSpXCI6IFwiZFwiLFxuICBcIuaXpVwiOiBcImRcIixcbiAgXCLlkahcIjogXCJ3XCIsXG4gIFwi5pif5pyfXCI6IFwid1wiLFxuICBcIuekvOaLnFwiOiBcIndcIixcbiAgXCLmnIhcIjogXCJNXCIsXG4gIFwi5Liq5pyIXCI6IFwiTVwiLFxuICBcIuW5tFwiOiBcInlcIixcbn07XG4iLCJpbXBvcnQge1xuICBBcHAsXG4gIEVkaXRvcixcbiAgRWRpdG9yUmFuZ2UsXG4gIEVkaXRvclBvc2l0aW9uLFxuICBub3JtYWxpemVQYXRoLFxuICBURmlsZSxcbiAgbW9tZW50LFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGNyZWF0ZURhaWx5Tm90ZSwgZ2V0QWxsRGFpbHlOb3RlcywgZ2V0RGFpbHlOb3RlIH0gZnJvbSBcIi4vZGFpbHktbm90ZXNcIjtcbmltcG9ydCB7IERheU9mV2VlayB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBaSF9PUkRJTkFMUyB9IGZyb20gXCIuL2xvY2FsZVwiO1xuXG5jb25zdCBkYXlzT2ZXZWVrOiBPbWl0PERheU9mV2VlaywgXCJsb2NhbGUtZGVmYXVsdFwiPltdID0gW1xuICBcInN1bmRheVwiLFxuICBcIm1vbmRheVwiLFxuICBcInR1ZXNkYXlcIixcbiAgXCJ3ZWRuZXNkYXlcIixcbiAgXCJ0aHVyc2RheVwiLFxuICBcImZyaWRheVwiLFxuICBcInNhdHVyZGF5XCIsXG5dO1xuXG5kZWNsYXJlIG1vZHVsZSBcIm9ic2lkaWFuXCIge1xuICBpbnRlcmZhY2UgRWRpdG9yIHtcbiAgICBjbToge1xuICAgICAgc3RhdGU6IHtcbiAgICAgICAgd29yZEF0KHBvczogbnVtYmVyKTogeyBmcm9tOiBudW1iZXI7IHRvOiBudW1iZXIgfSB8IG51bGw7XG4gICAgICB9O1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0V29yZEJvdW5kYXJpZXMoZWRpdG9yOiBFZGl0b3IpOiBFZGl0b3JSYW5nZSB7XG4gIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcbiAgY29uc3QgcG9zID0gZWRpdG9yLnBvc1RvT2Zmc2V0KGN1cnNvcik7XG4gIGNvbnN0IHdvcmQgPSBlZGl0b3IuY20uc3RhdGUud29yZEF0KHBvcyk7XG4gIGlmICghd29yZCkge1xuICAgIHJldHVybiB7XG4gICAgICBmcm9tOiBlZGl0b3Iub2Zmc2V0VG9Qb3MocG9zKSxcbiAgICAgIHRvOiBlZGl0b3Iub2Zmc2V0VG9Qb3MocG9zKSxcbiAgICB9O1xuICB9XG4gIGNvbnN0IHdvcmRTdGFydCA9IGVkaXRvci5vZmZzZXRUb1Bvcyh3b3JkLmZyb20pO1xuICBjb25zdCB3b3JkRW5kID0gZWRpdG9yLm9mZnNldFRvUG9zKHdvcmQudG8pO1xuICByZXR1cm4ge1xuICAgIGZyb206IHdvcmRTdGFydCxcbiAgICB0bzogd29yZEVuZCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlbGVjdGVkVGV4dChlZGl0b3I6IEVkaXRvcik6IHN0cmluZyB7XG4gIGlmIChlZGl0b3Iuc29tZXRoaW5nU2VsZWN0ZWQoKSkge1xuICAgIHJldHVybiBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgd29yZEJvdW5kYXJpZXMgPSBnZXRXb3JkQm91bmRhcmllcyhlZGl0b3IpO1xuICAgIGVkaXRvci5zZXRTZWxlY3Rpb24od29yZEJvdW5kYXJpZXMuZnJvbSwgd29yZEJvdW5kYXJpZXMudG8pO1xuICAgIHJldHVybiBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkanVzdEN1cnNvcihcbiAgZWRpdG9yOiBFZGl0b3IsXG4gIGN1cnNvcjogRWRpdG9yUG9zaXRpb24sXG4gIG5ld1N0cjogc3RyaW5nLFxuICBvbGRTdHI6IHN0cmluZ1xuKTogdm9pZCB7XG4gIGNvbnN0IGN1cnNvck9mZnNldCA9IG5ld1N0ci5sZW5ndGggLSBvbGRTdHIubGVuZ3RoO1xuICBlZGl0b3Iuc2V0Q3Vyc29yKHtcbiAgICBsaW5lOiBjdXJzb3IubGluZSxcbiAgICBjaDogY3Vyc29yLmNoICsgY3Vyc29yT2Zmc2V0LFxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZvcm1hdHRlZERhdGUoZGF0ZTogRGF0ZSwgZm9ybWF0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gd2luZG93Lm1vbWVudChkYXRlKS5mb3JtYXQoZm9ybWF0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldExhc3REYXlPZk1vbnRoKHllYXI6IG51bWJlciwgbW9udGg6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgMCkuZ2V0RGF0ZSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUcnV0aHkoZmxhZzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBbXCJ5XCIsIFwieWVzXCIsIFwiMVwiLCBcInRcIiwgXCJ0cnVlXCJdLmluZGV4T2YoZmxhZy50b0xvd2VyQ2FzZSgpKSA+PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0V2Vla051bWJlcihcbiAgZGF5T2ZXZWVrOiBPbWl0PERheU9mV2VlaywgXCJsb2NhbGUtZGVmYXVsdFwiPlxuKTogbnVtYmVyIHtcbiAgcmV0dXJuIGRheXNPZldlZWsuaW5kZXhPZihkYXlPZldlZWspO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlV2Vla1N0YXJ0KCk6IE9taXQ8RGF5T2ZXZWVrLCBcImxvY2FsZS1kZWZhdWx0XCI+IHtcbiAgY29uc3QgbG9jYWxlRGF0YSA9IHdpbmRvdy5tb21lbnQubG9jYWxlRGF0YSgpIGFzIHVua25vd24gYXMge1xuICAgIF93ZWVrOiB7IGRvdzogbnVtYmVyIH07XG4gIH07XG4gIGNvbnN0IHN0YXJ0T2ZXZWVrOiBudW1iZXIgPSBsb2NhbGVEYXRhLl93ZWVrLmRvdztcbiAgcmV0dXJuIGRheXNPZldlZWtbc3RhcnRPZldlZWtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVNYXJrZG93bkxpbmsoXG4gIGFwcDogQXBwLFxuICBzdWJwYXRoOiBzdHJpbmcsXG4gIGFsaWFzPzogc3RyaW5nXG4pOiBzdHJpbmcge1xuICBjb25zdCB1c2VNYXJrZG93bkxpbmtzID0gKFxuICAgIGFwcC52YXVsdCBhcyB1bmtub3duIGFzIHsgZ2V0Q29uZmlnKGtleTogc3RyaW5nKTogYm9vbGVhbiB9XG4gICkuZ2V0Q29uZmlnKFwidXNlTWFya2Rvd25MaW5rc1wiKTtcbiAgY29uc3QgcGF0aCA9IG5vcm1hbGl6ZVBhdGgoc3VicGF0aCk7XG5cbiAgaWYgKHVzZU1hcmtkb3duTGlua3MpIHtcbiAgICBpZiAoYWxpYXMpIHtcbiAgICAgIHJldHVybiBgWyR7YWxpYXN9XSgke3BhdGgucmVwbGFjZSgvIC9nLCBcIiUyMFwiKX0pYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGBbJHtzdWJwYXRofV0oJHtwYXRofSlgO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoYWxpYXMpIHtcbiAgICAgIHJldHVybiBgW1ske3BhdGh9fCR7YWxpYXN9XV1gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYFtbJHtwYXRofV1dYDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERhdGVMaW5rQWxpYXMoXG4gIHBsdWdpbjoge1xuICAgIHNldHRpbmdzOiB7IGRlZmF1bHRBbGlhczogc3RyaW5nIH07XG4gICAgcGFyc2VEYXRlOiAoczogc3RyaW5nKSA9PiB7IG1vbWVudDogbW9tZW50Lk1vbWVudCB9O1xuICB9LFxuICBkYXRlSW5wdXQ6IHN0cmluZyxcbiAgdXNlU3VnZ2VzdGlvbkxhYmVsOiBib29sZWFuXG4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAodXNlU3VnZ2VzdGlvbkxhYmVsKSB7XG4gICAgcmV0dXJuIGRhdGVJbnB1dDtcbiAgfVxuICBpZiAocGx1Z2luLnNldHRpbmdzLmRlZmF1bHRBbGlhcykge1xuICAgIGNvbnN0IHBhcnNlZCA9IHBsdWdpbi5wYXJzZURhdGUoZGF0ZUlucHV0KTtcbiAgICByZXR1cm4gcGFyc2VkLm1vbWVudC5pc1ZhbGlkKClcbiAgICAgID8gcGFyc2VkLm1vbWVudC5mb3JtYXQocGx1Z2luLnNldHRpbmdzLmRlZmF1bHRBbGlhcylcbiAgICAgIDogdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRPckNyZWF0ZURhaWx5Tm90ZShcbiAgZGF0ZTogbW9tZW50Lk1vbWVudFxuKTogUHJvbWlzZTxURmlsZSB8IG51bGw+IHtcbiAgY29uc3QgZGVzaXJlZE5vdGUgPSBnZXREYWlseU5vdGUoZGF0ZSwgZ2V0QWxsRGFpbHlOb3RlcygpKTtcbiAgaWYgKGRlc2lyZWROb3RlKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShkZXNpcmVkTm90ZSk7XG4gIH1cbiAgcmV0dXJuIGNyZWF0ZURhaWx5Tm90ZShkYXRlKTtcbn1cblxuLy8gLS0tLSDkuK3mlofluo/mlbDor43op6PmnpAgLS0tLVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlWmhPcmRpbmFsKHRleHQ6IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICBjb25zdCBtYXRjaCA9IHRleHQubWF0Y2goL+esrChb5LiA5LqM5LiJ5Zub5LqU5YWt5LiD5YWr5Lmd5Y2B5bu/5Y2FXSspLyk7XG4gIGlmIChtYXRjaCAmJiBaSF9PUkRJTkFMU1ttYXRjaFsxXV0gIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBaSF9PUkRJTkFMU1ttYXRjaFsxXV07XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG4iLCJpbXBvcnQgeyBBcHAsIE1hcmtkb3duVmlldywgTW9kYWwsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlTWFya2Rvd25MaW5rLCBnZXREYXRlTGlua0FsaWFzIH0gZnJvbSBcInNyYy91dGlsc1wiO1xuaW1wb3J0IHR5cGUgTmF0dXJhbExhbmd1YWdlRGF0ZXMgZnJvbSBcIi4uL21haW5cIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGF0ZVBpY2tlck1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBsZXQgcHJldmlld0VsOiBIVE1MRWxlbWVudDtcblxuICAgIGxldCBkYXRlSW5wdXQgPSBcIlwiO1xuICAgIGxldCBtb21lbnRGb3JtYXQgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb2RhbE1vbWVudEZvcm1hdDtcbiAgICBsZXQgaW5zZXJ0QXNMaW5rID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kYWxUb2dnbGVMaW5rO1xuXG4gICAgY29uc3QgZ2V0RGF0ZVN0ciA9ICgpID0+IHtcbiAgICAgIGxldCBjbGVhbkRhdGVJbnB1dCA9IGRhdGVJbnB1dDtcbiAgICAgIGxldCBzaG91bGRJbmNsdWRlQWxpYXMgPSBmYWxzZTtcblxuICAgICAgaWYgKGRhdGVJbnB1dC5lbmRzV2l0aChcInxcIikpIHtcbiAgICAgICAgc2hvdWxkSW5jbHVkZUFsaWFzID0gdHJ1ZTtcbiAgICAgICAgY2xlYW5EYXRlSW5wdXQgPSBkYXRlSW5wdXQuc2xpY2UoMCwgLTEpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWREYXRlID0gdGhpcy5wbHVnaW4ucGFyc2VEYXRlKGNsZWFuRGF0ZUlucHV0IHx8IFwi5LuK5aSpXCIpO1xuICAgICAgbGV0IHBhcnNlZERhdGVTdHJpbmcgPSBwYXJzZWREYXRlLm1vbWVudC5pc1ZhbGlkKClcbiAgICAgICAgPyBwYXJzZWREYXRlLm1vbWVudC5mb3JtYXQobW9tZW50Rm9ybWF0KVxuICAgICAgICA6IFwiXCI7XG5cbiAgICAgIGlmIChpbnNlcnRBc0xpbmspIHtcbiAgICAgICAgY29uc3QgYWxpYXMgPSBnZXREYXRlTGlua0FsaWFzKFxuICAgICAgICAgIHRoaXMucGx1Z2luLFxuICAgICAgICAgIGNsZWFuRGF0ZUlucHV0LFxuICAgICAgICAgIHNob3VsZEluY2x1ZGVBbGlhc1xuICAgICAgICApO1xuICAgICAgICBwYXJzZWREYXRlU3RyaW5nID0gZ2VuZXJhdGVNYXJrZG93bkxpbmsoXG4gICAgICAgICAgdGhpcy5hcHAsXG4gICAgICAgICAgcGFyc2VkRGF0ZVN0cmluZyxcbiAgICAgICAgICBhbGlhc1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyc2VkRGF0ZVN0cmluZztcbiAgICB9O1xuXG4gICAgdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJmb3JtXCIsIHt9LCAoZm9ybUVsKSA9PiB7XG4gICAgICBjb25zdCBkYXRlSW5wdXRFbCA9IG5ldyBTZXR0aW5nKGZvcm1FbClcbiAgICAgICAgLnNldE5hbWUoXCLml6XmnJ9cIilcbiAgICAgICAgLnNldERlc2MoZ2V0RGF0ZVN0cigpKVxuICAgICAgICAuYWRkVGV4dCgodGV4dEVsKSA9PiB7XG4gICAgICAgICAgdGV4dEVsLnNldFBsYWNlaG9sZGVyKFwi5LuK5aSpXCIpO1xuXG4gICAgICAgICAgdGV4dEVsLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgZGF0ZUlucHV0ID0gdmFsdWU7XG4gICAgICAgICAgICBwcmV2aWV3RWwuc2V0VGV4dChnZXREYXRlU3RyKCkpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGV4dEVsLmlucHV0RWwuZm9jdXMoKSwgMTApO1xuICAgICAgICB9KTtcbiAgICAgIHByZXZpZXdFbCA9IGRhdGVJbnB1dEVsLmRlc2NFbDtcblxuICAgICAgbmV3IFNldHRpbmcoZm9ybUVsKVxuICAgICAgICAuc2V0TmFtZShcIuaXpeacn+agvOW8j1wiKVxuICAgICAgICAuc2V0RGVzYyhcIk1vbWVudC5qcyDmoLzlvI/lrZfnrKbkuLJcIilcbiAgICAgICAgLmFkZE1vbWVudEZvcm1hdCgobW9tZW50RWwpID0+IHtcbiAgICAgICAgICBtb21lbnRFbC5zZXRQbGFjZWhvbGRlcihcIui+k+WFpeagvOW8j1wiKTtcbiAgICAgICAgICBtb21lbnRFbC5zZXRWYWx1ZShtb21lbnRGb3JtYXQpO1xuICAgICAgICAgIG1vbWVudEVsLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgbW9tZW50Rm9ybWF0ID0gdmFsdWUudHJpbSgpIHx8IFwiWVlZWS1NTS1ERCBISDptbVwiO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kYWxNb21lbnRGb3JtYXQgPSBtb21lbnRGb3JtYXQ7XG4gICAgICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgcHJldmlld0VsLnNldFRleHQoZ2V0RGF0ZVN0cigpKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgIG5ldyBTZXR0aW5nKGZvcm1FbClcbiAgICAgICAgLnNldE5hbWUoXCLmj5LlhaXkuLrpk77mjqXvvJ9cIilcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlRWwpID0+IHtcbiAgICAgICAgICB0b2dnbGVFbFxuICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm1vZGFsVG9nZ2xlTGluaylcbiAgICAgICAgICAgIC5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgaW5zZXJ0QXNMaW5rID0gdmFsdWU7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vZGFsVG9nZ2xlTGluayA9IGluc2VydEFzTGluaztcbiAgICAgICAgICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgcHJldmlld0VsLnNldFRleHQoZ2V0RGF0ZVN0cigpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgZm9ybUVsLmNyZWF0ZURpdihcIm1vZGFsLWJ1dHRvbi1jb250YWluZXJcIiwgKGJ1dHRvbkNvbnRhaW5lckVsKSA9PiB7XG4gICAgICAgIGJ1dHRvbkNvbnRhaW5lckVsXG4gICAgICAgICAgLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgICAgIGF0dHI6IHsgdHlwZTogXCJidXR0b25cIiB9LFxuICAgICAgICAgICAgdGV4dDogXCLlj5bmtohcIixcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5jbG9zZSgpKTtcbiAgICAgICAgYnV0dG9uQ29udGFpbmVyRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICAgIGF0dHI6IHsgdHlwZTogXCJzdWJtaXRcIiB9LFxuICAgICAgICAgIGNsczogXCJtb2QtY3RhXCIsXG4gICAgICAgICAgdGV4dDogXCLmj5LlhaXml6XmnJ9cIixcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgYWN0aXZlVmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICBpZiAoYWN0aXZlVmlldykge1xuICAgICAgICBjb25zdCBhY3RpdmVFZGl0b3IgPSBhY3RpdmVWaWV3LmVkaXRvcjtcbiAgICAgICAgZm9ybUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJzdWJtaXRcIiwgKGU6IEV2ZW50KSA9PiB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICBhY3RpdmVFZGl0b3IucmVwbGFjZVNlbGVjdGlvbihnZXREYXRlU3RyKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIiwiZXhwb3J0IHZhciBNZXJpZGllbTtcbihmdW5jdGlvbiAoTWVyaWRpZW0pIHtcbiAgICBNZXJpZGllbVtNZXJpZGllbVtcIkFNXCJdID0gMF0gPSBcIkFNXCI7XG4gICAgTWVyaWRpZW1bTWVyaWRpZW1bXCJQTVwiXSA9IDFdID0gXCJQTVwiO1xufSkoTWVyaWRpZW0gfHwgKE1lcmlkaWVtID0ge30pKTtcbmV4cG9ydCB2YXIgV2Vla2RheTtcbihmdW5jdGlvbiAoV2Vla2RheSkge1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIlNVTkRBWVwiXSA9IDBdID0gXCJTVU5EQVlcIjtcbiAgICBXZWVrZGF5W1dlZWtkYXlbXCJNT05EQVlcIl0gPSAxXSA9IFwiTU9OREFZXCI7XG4gICAgV2Vla2RheVtXZWVrZGF5W1wiVFVFU0RBWVwiXSA9IDJdID0gXCJUVUVTREFZXCI7XG4gICAgV2Vla2RheVtXZWVrZGF5W1wiV0VETkVTREFZXCJdID0gM10gPSBcIldFRE5FU0RBWVwiO1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIlRIVVJTREFZXCJdID0gNF0gPSBcIlRIVVJTREFZXCI7XG4gICAgV2Vla2RheVtXZWVrZGF5W1wiRlJJREFZXCJdID0gNV0gPSBcIkZSSURBWVwiO1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIlNBVFVSREFZXCJdID0gNl0gPSBcIlNBVFVSREFZXCI7XG59KShXZWVrZGF5IHx8IChXZWVrZGF5ID0ge30pKTtcbmV4cG9ydCB2YXIgTW9udGg7XG4oZnVuY3Rpb24gKE1vbnRoKSB7XG4gICAgTW9udGhbTW9udGhbXCJKQU5VQVJZXCJdID0gMV0gPSBcIkpBTlVBUllcIjtcbiAgICBNb250aFtNb250aFtcIkZFQlJVQVJZXCJdID0gMl0gPSBcIkZFQlJVQVJZXCI7XG4gICAgTW9udGhbTW9udGhbXCJNQVJDSFwiXSA9IDNdID0gXCJNQVJDSFwiO1xuICAgIE1vbnRoW01vbnRoW1wiQVBSSUxcIl0gPSA0XSA9IFwiQVBSSUxcIjtcbiAgICBNb250aFtNb250aFtcIk1BWVwiXSA9IDVdID0gXCJNQVlcIjtcbiAgICBNb250aFtNb250aFtcIkpVTkVcIl0gPSA2XSA9IFwiSlVORVwiO1xuICAgIE1vbnRoW01vbnRoW1wiSlVMWVwiXSA9IDddID0gXCJKVUxZXCI7XG4gICAgTW9udGhbTW9udGhbXCJBVUdVU1RcIl0gPSA4XSA9IFwiQVVHVVNUXCI7XG4gICAgTW9udGhbTW9udGhbXCJTRVBURU1CRVJcIl0gPSA5XSA9IFwiU0VQVEVNQkVSXCI7XG4gICAgTW9udGhbTW9udGhbXCJPQ1RPQkVSXCJdID0gMTBdID0gXCJPQ1RPQkVSXCI7XG4gICAgTW9udGhbTW9udGhbXCJOT1ZFTUJFUlwiXSA9IDExXSA9IFwiTk9WRU1CRVJcIjtcbiAgICBNb250aFtNb250aFtcIkRFQ0VNQkVSXCJdID0gMTJdID0gXCJERUNFTUJFUlwiO1xufSkoTW9udGggfHwgKE1vbnRoID0ge30pKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXR5cGVzLmpzLm1hcCIsImltcG9ydCB7IE1lcmlkaWVtIH0gZnJvbSBcIi4uL3R5cGVzLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50LCB0YXJnZXQpIHtcbiAgICBjb21wb25lbnQuYXNzaWduKFwiZGF5XCIsIHRhcmdldC5nZXREYXRlKCkpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJtb250aFwiLCB0YXJnZXQuZ2V0TW9udGgoKSArIDEpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJ5ZWFyXCIsIHRhcmdldC5nZXRGdWxsWWVhcigpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBhc3NpZ25TaW1pbGFyVGltZShjb21wb25lbnQsIHRhcmdldCkge1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJob3VyXCIsIHRhcmdldC5nZXRIb3VycygpKTtcbiAgICBjb21wb25lbnQuYXNzaWduKFwibWludXRlXCIsIHRhcmdldC5nZXRNaW51dGVzKCkpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJzZWNvbmRcIiwgdGFyZ2V0LmdldFNlY29uZHMoKSk7XG4gICAgY29tcG9uZW50LmFzc2lnbihcIm1pbGxpc2Vjb25kXCIsIHRhcmdldC5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgY29tcG9uZW50LmFzc2lnbihcIm1lcmlkaWVtXCIsIHRhcmdldC5nZXRIb3VycygpIDwgMTIgPyBNZXJpZGllbS5BTSA6IE1lcmlkaWVtLlBNKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpbXBseVNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0KSB7XG4gICAgY29tcG9uZW50LmltcGx5KFwiZGF5XCIsIHRhcmdldC5nZXREYXRlKCkpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1vbnRoXCIsIHRhcmdldC5nZXRNb250aCgpICsgMSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwieWVhclwiLCB0YXJnZXQuZ2V0RnVsbFllYXIoKSk7XG59XG5leHBvcnQgZnVuY3Rpb24gaW1wbHlTaW1pbGFyVGltZShjb21wb25lbnQsIHRhcmdldCkge1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgdGFyZ2V0LmdldEhvdXJzKCkpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbnV0ZVwiLCB0YXJnZXQuZ2V0TWludXRlcygpKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJzZWNvbmRcIiwgdGFyZ2V0LmdldFNlY29uZHMoKSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgdGFyZ2V0LmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCB0YXJnZXQuZ2V0SG91cnMoKSA8IDEyID8gTWVyaWRpZW0uQU0gOiBNZXJpZGllbS5QTSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRlcy5qcy5tYXAiLCJpbXBvcnQgeyBXZWVrZGF5LCBNb250aCB9IGZyb20gXCIuL3R5cGVzLmpzXCI7XG5leHBvcnQgY29uc3QgVElNRVpPTkVfQUJCUl9NQVAgPSB7XG4gICAgQUNEVDogNjMwLFxuICAgIEFDU1Q6IDU3MCxcbiAgICBBRFQ6IC0xODAsXG4gICAgQUVEVDogNjYwLFxuICAgIEFFU1Q6IDYwMCxcbiAgICBBRlQ6IDI3MCxcbiAgICBBS0RUOiAtNDgwLFxuICAgIEFLU1Q6IC01NDAsXG4gICAgQUxNVDogMzYwLFxuICAgIEFNU1Q6IC0xODAsXG4gICAgQU1UOiAtMjQwLFxuICAgIEFOQVNUOiA3MjAsXG4gICAgQU5BVDogNzIwLFxuICAgIEFRVFQ6IDMwMCxcbiAgICBBUlQ6IC0xODAsXG4gICAgQVNUOiAtMjQwLFxuICAgIEFXRFQ6IDU0MCxcbiAgICBBV1NUOiA0ODAsXG4gICAgQVpPU1Q6IDAsXG4gICAgQVpPVDogLTYwLFxuICAgIEFaU1Q6IDMwMCxcbiAgICBBWlQ6IDI0MCxcbiAgICBCTlQ6IDQ4MCxcbiAgICBCT1Q6IC0yNDAsXG4gICAgQlJTVDogLTEyMCxcbiAgICBCUlQ6IC0xODAsXG4gICAgQlNUOiA2MCxcbiAgICBCVFQ6IDM2MCxcbiAgICBDQVNUOiA0ODAsXG4gICAgQ0FUOiAxMjAsXG4gICAgQ0NUOiAzOTAsXG4gICAgQ0RUOiAtMzAwLFxuICAgIENFU1Q6IDEyMCxcbiAgICBDRVQ6IHtcbiAgICAgICAgdGltZXpvbmVPZmZzZXREdXJpbmdEc3Q6IDIgKiA2MCxcbiAgICAgICAgdGltZXpvbmVPZmZzZXROb25Ec3Q6IDYwLFxuICAgICAgICBkc3RTdGFydDogKHllYXIpID0+IGdldExhc3RXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXRMYXN0V2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguT0NUT0JFUiwgV2Vla2RheS5TVU5EQVksIDMpLFxuICAgIH0sXG4gICAgQ0hBRFQ6IDgyNSxcbiAgICBDSEFTVDogNzY1LFxuICAgIENLVDogLTYwMCxcbiAgICBDTFNUOiAtMTgwLFxuICAgIENMVDogLTI0MCxcbiAgICBDT1Q6IC0zMDAsXG4gICAgQ1NUOiAtMzYwLFxuICAgIENUOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNSAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTYgKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgQ1ZUOiAtNjAsXG4gICAgQ1hUOiA0MjAsXG4gICAgQ2hTVDogNjAwLFxuICAgIERBVlQ6IDQyMCxcbiAgICBFQVNTVDogLTMwMCxcbiAgICBFQVNUOiAtMzYwLFxuICAgIEVBVDogMTgwLFxuICAgIEVDVDogLTMwMCxcbiAgICBFRFQ6IC0yNDAsXG4gICAgRUVTVDogMTgwLFxuICAgIEVFVDogMTIwLFxuICAgIEVHU1Q6IDAsXG4gICAgRUdUOiAtNjAsXG4gICAgRVNUOiAtMzAwLFxuICAgIEVUOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNCAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTUgKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgRkpTVDogNzgwLFxuICAgIEZKVDogNzIwLFxuICAgIEZLU1Q6IC0xODAsXG4gICAgRktUOiAtMjQwLFxuICAgIEZOVDogLTEyMCxcbiAgICBHQUxUOiAtMzYwLFxuICAgIEdBTVQ6IC01NDAsXG4gICAgR0VUOiAyNDAsXG4gICAgR0ZUOiAtMTgwLFxuICAgIEdJTFQ6IDcyMCxcbiAgICBHTVQ6IDAsXG4gICAgR1NUOiAyNDAsXG4gICAgR1lUOiAtMjQwLFxuICAgIEhBQTogLTE4MCxcbiAgICBIQUM6IC0zMDAsXG4gICAgSEFEVDogLTU0MCxcbiAgICBIQUU6IC0yNDAsXG4gICAgSEFQOiAtNDIwLFxuICAgIEhBUjogLTM2MCxcbiAgICBIQVNUOiAtNjAwLFxuICAgIEhBVDogLTkwLFxuICAgIEhBWTogLTQ4MCxcbiAgICBIS1Q6IDQ4MCxcbiAgICBITFY6IC0yMTAsXG4gICAgSE5BOiAtMjQwLFxuICAgIEhOQzogLTM2MCxcbiAgICBITkU6IC0zMDAsXG4gICAgSE5QOiAtNDgwLFxuICAgIEhOUjogLTQyMCxcbiAgICBITlQ6IC0xNTAsXG4gICAgSE5ZOiAtNTQwLFxuICAgIEhPVlQ6IDQyMCxcbiAgICBJQ1Q6IDQyMCxcbiAgICBJRFQ6IDE4MCxcbiAgICBJT1Q6IDM2MCxcbiAgICBJUkRUOiAyNzAsXG4gICAgSVJLU1Q6IDU0MCxcbiAgICBJUktUOiA1NDAsXG4gICAgSVJTVDogMjEwLFxuICAgIElTVDogMzMwLFxuICAgIEpTVDogNTQwLFxuICAgIEtHVDogMzYwLFxuICAgIEtSQVNUOiA0ODAsXG4gICAgS1JBVDogNDgwLFxuICAgIEtTVDogNTQwLFxuICAgIEtVWVQ6IDI0MCxcbiAgICBMSERUOiA2NjAsXG4gICAgTEhTVDogNjMwLFxuICAgIExJTlQ6IDg0MCxcbiAgICBNQUdTVDogNzIwLFxuICAgIE1BR1Q6IDcyMCxcbiAgICBNQVJUOiAtNTEwLFxuICAgIE1BV1Q6IDMwMCxcbiAgICBNRFQ6IC0zNjAsXG4gICAgTUVTWjogMTIwLFxuICAgIE1FWjogNjAsXG4gICAgTUhUOiA3MjAsXG4gICAgTU1UOiAzOTAsXG4gICAgTVNEOiAyNDAsXG4gICAgTVNLOiAxODAsXG4gICAgTVNUOiAtNDIwLFxuICAgIE1UOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNiAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTcgKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgTVVUOiAyNDAsXG4gICAgTVZUOiAzMDAsXG4gICAgTVlUOiA0ODAsXG4gICAgTkNUOiA2NjAsXG4gICAgTkRUOiAtOTAsXG4gICAgTkZUOiA2OTAsXG4gICAgTk9WU1Q6IDQyMCxcbiAgICBOT1ZUOiAzNjAsXG4gICAgTlBUOiAzNDUsXG4gICAgTlNUOiAtMTUwLFxuICAgIE5VVDogLTY2MCxcbiAgICBOWkRUOiA3ODAsXG4gICAgTlpTVDogNzIwLFxuICAgIE9NU1NUOiA0MjAsXG4gICAgT01TVDogNDIwLFxuICAgIFBEVDogLTQyMCxcbiAgICBQRVQ6IC0zMDAsXG4gICAgUEVUU1Q6IDcyMCxcbiAgICBQRVRUOiA3MjAsXG4gICAgUEdUOiA2MDAsXG4gICAgUEhPVDogNzgwLFxuICAgIFBIVDogNDgwLFxuICAgIFBLVDogMzAwLFxuICAgIFBNRFQ6IC0xMjAsXG4gICAgUE1TVDogLTE4MCxcbiAgICBQT05UOiA2NjAsXG4gICAgUFNUOiAtNDgwLFxuICAgIFBUOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNyAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTggKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgUFdUOiA1NDAsXG4gICAgUFlTVDogLTE4MCxcbiAgICBQWVQ6IC0yNDAsXG4gICAgUkVUOiAyNDAsXG4gICAgU0FNVDogMjQwLFxuICAgIFNBU1Q6IDEyMCxcbiAgICBTQlQ6IDY2MCxcbiAgICBTQ1Q6IDI0MCxcbiAgICBTR1Q6IDQ4MCxcbiAgICBTUlQ6IC0xODAsXG4gICAgU1NUOiAtNjYwLFxuICAgIFRBSFQ6IC02MDAsXG4gICAgVEZUOiAzMDAsXG4gICAgVEpUOiAzMDAsXG4gICAgVEtUOiA3ODAsXG4gICAgVExUOiA1NDAsXG4gICAgVE1UOiAzMDAsXG4gICAgVFZUOiA3MjAsXG4gICAgVUxBVDogNDgwLFxuICAgIFVUQzogMCxcbiAgICBVWVNUOiAtMTIwLFxuICAgIFVZVDogLTE4MCxcbiAgICBVWlQ6IDMwMCxcbiAgICBWRVQ6IC0yMTAsXG4gICAgVkxBU1Q6IDY2MCxcbiAgICBWTEFUOiA2NjAsXG4gICAgVlVUOiA2NjAsXG4gICAgV0FTVDogMTIwLFxuICAgIFdBVDogNjAsXG4gICAgV0VTVDogNjAsXG4gICAgV0VTWjogNjAsXG4gICAgV0VUOiAwLFxuICAgIFdFWjogMCxcbiAgICBXRlQ6IDcyMCxcbiAgICBXR1NUOiAtMTIwLFxuICAgIFdHVDogLTE4MCxcbiAgICBXSUI6IDQyMCxcbiAgICBXSVQ6IDU0MCxcbiAgICBXSVRBOiA0ODAsXG4gICAgV1NUOiA3ODAsXG4gICAgV1Q6IDAsXG4gICAgWUFLU1Q6IDYwMCxcbiAgICBZQUtUOiA2MDAsXG4gICAgWUFQVDogNjAwLFxuICAgIFlFS1NUOiAzNjAsXG4gICAgWUVLVDogMzYwLFxufTtcbmV4cG9ydCBmdW5jdGlvbiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBtb250aCwgd2Vla2RheSwgbiwgaG91ciA9IDApIHtcbiAgICBsZXQgZGF5T2ZNb250aCA9IDA7XG4gICAgbGV0IGkgPSAwO1xuICAgIHdoaWxlIChpIDwgbikge1xuICAgICAgICBkYXlPZk1vbnRoKys7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCAtIDEsIGRheU9mTW9udGgpO1xuICAgICAgICBpZiAoZGF0ZS5nZXREYXkoKSA9PT0gd2Vla2RheSlcbiAgICAgICAgICAgIGkrKztcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEYXRlKHllYXIsIG1vbnRoIC0gMSwgZGF5T2ZNb250aCwgaG91cik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFzdFdlZWtkYXlPZk1vbnRoKHllYXIsIG1vbnRoLCB3ZWVrZGF5LCBob3VyID0gMCkge1xuICAgIGNvbnN0IG9uZUluZGV4ZWRXZWVrZGF5ID0gd2Vla2RheSA9PT0gMCA/IDcgOiB3ZWVrZGF5O1xuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCAtIDEgKyAxLCAxLCAxMik7XG4gICAgY29uc3QgZmlyc3RXZWVrZGF5TmV4dE1vbnRoID0gZGF0ZS5nZXREYXkoKSA9PT0gMCA/IDcgOiBkYXRlLmdldERheSgpO1xuICAgIGxldCBkYXlEaWZmO1xuICAgIGlmIChmaXJzdFdlZWtkYXlOZXh0TW9udGggPT09IG9uZUluZGV4ZWRXZWVrZGF5KVxuICAgICAgICBkYXlEaWZmID0gNztcbiAgICBlbHNlIGlmIChmaXJzdFdlZWtkYXlOZXh0TW9udGggPCBvbmVJbmRleGVkV2Vla2RheSlcbiAgICAgICAgZGF5RGlmZiA9IDcgKyBmaXJzdFdlZWtkYXlOZXh0TW9udGggLSBvbmVJbmRleGVkV2Vla2RheTtcbiAgICBlbHNlXG4gICAgICAgIGRheURpZmYgPSBmaXJzdFdlZWtkYXlOZXh0TW9udGggLSBvbmVJbmRleGVkV2Vla2RheTtcbiAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSBkYXlEaWZmKTtcbiAgICByZXR1cm4gbmV3IERhdGUoeWVhciwgbW9udGggLSAxLCBkYXRlLmdldERhdGUoKSwgaG91cik7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9UaW1lem9uZU9mZnNldCh0aW1lem9uZUlucHV0LCBkYXRlLCB0aW1lem9uZU92ZXJyaWRlcyA9IHt9KSB7XG4gICAgaWYgKHRpbWV6b25lSW5wdXQgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB0aW1lem9uZUlucHV0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHJldHVybiB0aW1lem9uZUlucHV0O1xuICAgIH1cbiAgICBjb25zdCBtYXRjaGVkVGltZXpvbmUgPSB0aW1lem9uZU92ZXJyaWRlc1t0aW1lem9uZUlucHV0XSA/PyBUSU1FWk9ORV9BQkJSX01BUFt0aW1lem9uZUlucHV0XTtcbiAgICBpZiAobWF0Y2hlZFRpbWV6b25lID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbWF0Y2hlZFRpbWV6b25lID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgcmV0dXJuIG1hdGNoZWRUaW1lem9uZTtcbiAgICB9XG4gICAgaWYgKGRhdGUgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKGRhdGUgPiBtYXRjaGVkVGltZXpvbmUuZHN0U3RhcnQoZGF0ZS5nZXRGdWxsWWVhcigpKSAmJiAhKGRhdGUgPiBtYXRjaGVkVGltZXpvbmUuZHN0RW5kKGRhdGUuZ2V0RnVsbFllYXIoKSkpKSB7XG4gICAgICAgIHJldHVybiBtYXRjaGVkVGltZXpvbmUudGltZXpvbmVPZmZzZXREdXJpbmdEc3Q7XG4gICAgfVxuICAgIHJldHVybiBtYXRjaGVkVGltZXpvbmUudGltZXpvbmVPZmZzZXROb25Ec3Q7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD10aW1lem9uZS5qcy5tYXAiLCJleHBvcnQgY29uc3QgRW1wdHlEdXJhdGlvbiA9IHtcbiAgICBkYXk6IDAsXG4gICAgc2Vjb25kOiAwLFxuICAgIG1pbGxpc2Vjb25kOiAwLFxufTtcbmV4cG9ydCBmdW5jdGlvbiBhZGREdXJhdGlvbihyZWYsIGR1cmF0aW9uKSB7XG4gICAgbGV0IGRhdGUgPSBuZXcgRGF0ZShyZWYpO1xuICAgIGlmIChkdXJhdGlvbltcInlcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJ5ZWFyXCJdID0gZHVyYXRpb25bXCJ5XCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJ5XCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJtb1wiXSkge1xuICAgICAgICBkdXJhdGlvbltcIm1vbnRoXCJdID0gZHVyYXRpb25bXCJtb1wiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wibW9cIl07XG4gICAgfVxuICAgIGlmIChkdXJhdGlvbltcIk1cIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJtb250aFwiXSA9IGR1cmF0aW9uW1wiTVwiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wiTVwiXTtcbiAgICB9XG4gICAgaWYgKGR1cmF0aW9uW1wid1wiXSkge1xuICAgICAgICBkdXJhdGlvbltcIndlZWtcIl0gPSBkdXJhdGlvbltcIndcIl07XG4gICAgICAgIGRlbGV0ZSBkdXJhdGlvbltcIndcIl07XG4gICAgfVxuICAgIGlmIChkdXJhdGlvbltcImRcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJkYXlcIl0gPSBkdXJhdGlvbltcImRcIl07XG4gICAgICAgIGRlbGV0ZSBkdXJhdGlvbltcImRcIl07XG4gICAgfVxuICAgIGlmIChkdXJhdGlvbltcImhcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJob3VyXCJdID0gZHVyYXRpb25bXCJoXCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJoXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJtXCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wibWludXRlXCJdID0gZHVyYXRpb25bXCJtXCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJtXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJzXCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wic2Vjb25kXCJdID0gZHVyYXRpb25bXCJzXCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJzXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJtc1wiXSkge1xuICAgICAgICBkdXJhdGlvbltcIm1pbGxpc2Vjb25kXCJdID0gZHVyYXRpb25bXCJtc1wiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wibXNcIl07XG4gICAgfVxuICAgIGlmIChcInllYXJcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJ5ZWFyXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRGdWxsWWVhcihkYXRlLmdldEZ1bGxZZWFyKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJ5ZWFyXCJdIC0gZmxvb3I7XG4gICAgICAgIGlmIChyZW1haW5pbmdGcmFjdGlvbiA+IDApIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLm1vbnRoID0gZHVyYXRpb24/Lm1vbnRoID8/IDA7XG4gICAgICAgICAgICBkdXJhdGlvbi5tb250aCArPSByZW1haW5pbmdGcmFjdGlvbiAqIDEyO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcInF1YXJ0ZXJcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJxdWFydGVyXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRNb250aChkYXRlLmdldE1vbnRoKCkgKyBmbG9vciAqIDMpO1xuICAgIH1cbiAgICBpZiAoXCJtb250aFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcIm1vbnRoXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRNb250aChkYXRlLmdldE1vbnRoKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJtb250aFwiXSAtIGZsb29yO1xuICAgICAgICBpZiAocmVtYWluaW5nRnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi53ZWVrID0gZHVyYXRpb24/LndlZWsgPz8gMDtcbiAgICAgICAgICAgIGR1cmF0aW9uLndlZWsgKz0gcmVtYWluaW5nRnJhY3Rpb24gKiA0O1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcIndlZWtcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJ3ZWVrXCJdKTtcbiAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgZmxvb3IgKiA3KTtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nRnJhY3Rpb24gPSBkdXJhdGlvbltcIndlZWtcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24uZGF5ID0gZHVyYXRpb24/LmRheSA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24uZGF5ICs9IE1hdGgucm91bmQocmVtYWluaW5nRnJhY3Rpb24gKiA3KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXCJkYXlcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJkYXlcIl0pO1xuICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJkYXlcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24uaG91ciA9IGR1cmF0aW9uPy5ob3VyID8/IDA7XG4gICAgICAgICAgICBkdXJhdGlvbi5ob3VyICs9IE1hdGgucm91bmQocmVtYWluaW5nRnJhY3Rpb24gKiAyNCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKFwiaG91clwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcImhvdXJcIl0pO1xuICAgICAgICBkYXRlLnNldEhvdXJzKGRhdGUuZ2V0SG91cnMoKSArIGZsb29yKTtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nRnJhY3Rpb24gPSBkdXJhdGlvbltcImhvdXJcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24ubWludXRlID0gZHVyYXRpb24/Lm1pbnV0ZSA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24ubWludXRlICs9IE1hdGgucm91bmQocmVtYWluaW5nRnJhY3Rpb24gKiA2MCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKFwibWludXRlXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wibWludXRlXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRNaW51dGVzKGRhdGUuZ2V0TWludXRlcygpICsgZmxvb3IpO1xuICAgICAgICBjb25zdCByZW1haW5pbmdGcmFjdGlvbiA9IGR1cmF0aW9uW1wibWludXRlXCJdIC0gZmxvb3I7XG4gICAgICAgIGlmIChyZW1haW5pbmdGcmFjdGlvbiA+IDApIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLnNlY29uZCA9IGR1cmF0aW9uPy5zZWNvbmQgPz8gMDtcbiAgICAgICAgICAgIGR1cmF0aW9uLnNlY29uZCArPSBNYXRoLnJvdW5kKHJlbWFpbmluZ0ZyYWN0aW9uICogNjApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcInNlY29uZFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcInNlY29uZFwiXSk7XG4gICAgICAgIGRhdGUuc2V0U2Vjb25kcyhkYXRlLmdldFNlY29uZHMoKSArIGZsb29yKTtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nRnJhY3Rpb24gPSBkdXJhdGlvbltcInNlY29uZFwiXSAtIGZsb29yO1xuICAgICAgICBpZiAocmVtYWluaW5nRnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi5taWxsaXNlY29uZCA9IGR1cmF0aW9uPy5taWxsaXNlY29uZCA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24ubWlsbGlzZWNvbmQgKz0gTWF0aC5yb3VuZChyZW1haW5pbmdGcmFjdGlvbiAqIDEwMDApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcIm1pbGxpc2Vjb25kXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wibWlsbGlzZWNvbmRcIl0pO1xuICAgICAgICBkYXRlLnNldE1pbGxpc2Vjb25kcyhkYXRlLmdldE1pbGxpc2Vjb25kcygpICsgZmxvb3IpO1xuICAgIH1cbiAgICByZXR1cm4gZGF0ZTtcbn1cbmV4cG9ydCBmdW5jdGlvbiByZXZlcnNlRHVyYXRpb24oZHVyYXRpb24pIHtcbiAgICBjb25zdCByZXZlcnNlZCA9IHt9O1xuICAgIGZvciAoY29uc3Qga2V5IGluIGR1cmF0aW9uKSB7XG4gICAgICAgIHJldmVyc2VkW2tleV0gPSAtZHVyYXRpb25ba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIHJldmVyc2VkO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZHVyYXRpb24uanMubWFwIiwiaW1wb3J0IHsgYXNzaWduU2ltaWxhckRhdGUsIGFzc2lnblNpbWlsYXJUaW1lLCBpbXBseVNpbWlsYXJUaW1lIH0gZnJvbSBcIi4vdXRpbHMvZGF0ZXMuanNcIjtcbmltcG9ydCB7IHRvVGltZXpvbmVPZmZzZXQgfSBmcm9tIFwiLi90aW1lem9uZS5qc1wiO1xuaW1wb3J0IHsgYWRkRHVyYXRpb24sIEVtcHR5RHVyYXRpb24gfSBmcm9tIFwiLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZVdpdGhUaW1lem9uZSB7XG4gICAgaW5zdGFudDtcbiAgICB0aW1lem9uZU9mZnNldDtcbiAgICBjb25zdHJ1Y3RvcihpbnN0YW50LCB0aW1lem9uZU9mZnNldCkge1xuICAgICAgICB0aGlzLmluc3RhbnQgPSBpbnN0YW50ID8/IG5ldyBEYXRlKCk7XG4gICAgICAgIHRoaXMudGltZXpvbmVPZmZzZXQgPSB0aW1lem9uZU9mZnNldCA/PyBudWxsO1xuICAgIH1cbiAgICBzdGF0aWMgZnJvbURhdGUoZGF0ZSkge1xuICAgICAgICByZXR1cm4gbmV3IFJlZmVyZW5jZVdpdGhUaW1lem9uZShkYXRlKTtcbiAgICB9XG4gICAgc3RhdGljIGZyb21JbnB1dChpbnB1dCwgdGltZXpvbmVPdmVycmlkZXMpIHtcbiAgICAgICAgaWYgKGlucHV0IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIFJlZmVyZW5jZVdpdGhUaW1lem9uZS5mcm9tRGF0ZShpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaW5zdGFudCA9IGlucHV0Py5pbnN0YW50ID8/IG5ldyBEYXRlKCk7XG4gICAgICAgIGNvbnN0IHRpbWV6b25lT2Zmc2V0ID0gdG9UaW1lem9uZU9mZnNldChpbnB1dD8udGltZXpvbmUsIGluc3RhbnQsIHRpbWV6b25lT3ZlcnJpZGVzKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWZlcmVuY2VXaXRoVGltZXpvbmUoaW5zdGFudCwgdGltZXpvbmVPZmZzZXQpO1xuICAgIH1cbiAgICBnZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKSB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh0aGlzLmluc3RhbnQpO1xuICAgICAgICBpZiAodGhpcy50aW1lem9uZU9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZGF0ZS5zZXRNaW51dGVzKGRhdGUuZ2V0TWludXRlcygpIC0gdGhpcy5nZXRTeXN0ZW1UaW1lem9uZUFkanVzdG1lbnRNaW51dGUodGhpcy5pbnN0YW50KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfVxuICAgIGdldFN5c3RlbVRpbWV6b25lQWRqdXN0bWVudE1pbnV0ZShkYXRlLCBvdmVycmlkZVRpbWV6b25lT2Zmc2V0KSB7XG4gICAgICAgIGlmICghZGF0ZSkge1xuICAgICAgICAgICAgZGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY3VycmVudFRpbWV6b25lT2Zmc2V0ID0gLWRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0VGltZXpvbmVPZmZzZXQgPSBvdmVycmlkZVRpbWV6b25lT2Zmc2V0ID8/IHRoaXMudGltZXpvbmVPZmZzZXQgPz8gY3VycmVudFRpbWV6b25lT2Zmc2V0O1xuICAgICAgICByZXR1cm4gY3VycmVudFRpbWV6b25lT2Zmc2V0IC0gdGFyZ2V0VGltZXpvbmVPZmZzZXQ7XG4gICAgfVxuICAgIGdldFRpbWV6b25lT2Zmc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aW1lem9uZU9mZnNldCA/PyAtdGhpcy5pbnN0YW50LmdldFRpbWV6b25lT2Zmc2V0KCk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFBhcnNpbmdDb21wb25lbnRzIHtcbiAgICBrbm93blZhbHVlcztcbiAgICBpbXBsaWVkVmFsdWVzO1xuICAgIHJlZmVyZW5jZTtcbiAgICBfdGFncyA9IG5ldyBTZXQoKTtcbiAgICBjb25zdHJ1Y3RvcihyZWZlcmVuY2UsIGtub3duQ29tcG9uZW50cykge1xuICAgICAgICB0aGlzLnJlZmVyZW5jZSA9IHJlZmVyZW5jZTtcbiAgICAgICAgdGhpcy5rbm93blZhbHVlcyA9IHt9O1xuICAgICAgICB0aGlzLmltcGxpZWRWYWx1ZXMgPSB7fTtcbiAgICAgICAgaWYgKGtub3duQ29tcG9uZW50cykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4ga25vd25Db21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5rbm93blZhbHVlc1trZXldID0ga25vd25Db21wb25lbnRzW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICAgICAgdGhpcy5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgIHRoaXMuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgdGhpcy5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgdGhpcy5pbXBseShcImhvdXJcIiwgMTIpO1xuICAgICAgICB0aGlzLmltcGx5KFwibWludXRlXCIsIDApO1xuICAgICAgICB0aGlzLmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgICAgICB0aGlzLmltcGx5KFwibWlsbGlzZWNvbmRcIiwgMCk7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UocmVmZXJlbmNlLCBkdXJhdGlvbiA9IEVtcHR5RHVyYXRpb24pIHtcbiAgICAgICAgbGV0IGRhdGUgPSBhZGREdXJhdGlvbihyZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCksIGR1cmF0aW9uKTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UpO1xuICAgICAgICBjb21wb25lbnRzLmFkZFRhZyhcInJlc3VsdC9yZWxhdGl2ZURhdGVcIik7XG4gICAgICAgIGlmIChcImhvdXJcIiBpbiBkdXJhdGlvbiB8fCBcIm1pbnV0ZVwiIGluIGR1cmF0aW9uIHx8IFwic2Vjb25kXCIgaW4gZHVyYXRpb24gfHwgXCJtaWxsaXNlY29uZFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFkZFRhZyhcInJlc3VsdC9yZWxhdGl2ZURhdGVBbmRUaW1lXCIpO1xuICAgICAgICAgICAgYXNzaWduU2ltaWxhclRpbWUoY29tcG9uZW50cywgZGF0ZSk7XG4gICAgICAgICAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnRzLCBkYXRlKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwidGltZXpvbmVPZmZzZXRcIiwgcmVmZXJlbmNlLmdldFRpbWV6b25lT2Zmc2V0KCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaW1wbHlTaW1pbGFyVGltZShjb21wb25lbnRzLCBkYXRlKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJ0aW1lem9uZU9mZnNldFwiLCByZWZlcmVuY2UuZ2V0VGltZXpvbmVPZmZzZXQoKSk7XG4gICAgICAgICAgICBpZiAoXCJkYXlcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwid2Vla2RheVwiLCBkYXRlLmdldERheSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKFwid2Vla1wiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIndlZWtkYXlcIiwgZGF0ZS5nZXREYXkoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgICAgICBpZiAoXCJtb250aFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoXCJ5ZWFyXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcG9uZW50cztcbiAgICB9XG4gICAgZ2V0KGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoY29tcG9uZW50IGluIHRoaXMua25vd25WYWx1ZXMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmtub3duVmFsdWVzW2NvbXBvbmVudF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbXBvbmVudCBpbiB0aGlzLmltcGxpZWRWYWx1ZXMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpZWRWYWx1ZXNbY29tcG9uZW50XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaXNDZXJ0YWluKGNvbXBvbmVudCkge1xuICAgICAgICByZXR1cm4gY29tcG9uZW50IGluIHRoaXMua25vd25WYWx1ZXM7XG4gICAgfVxuICAgIGdldENlcnRhaW5Db21wb25lbnRzKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5rbm93blZhbHVlcyk7XG4gICAgfVxuICAgIGltcGx5KGNvbXBvbmVudCwgdmFsdWUpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudCBpbiB0aGlzLmtub3duVmFsdWVzKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmltcGxpZWRWYWx1ZXNbY29tcG9uZW50XSA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgYXNzaWduKGNvbXBvbmVudCwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5rbm93blZhbHVlc1tjb21wb25lbnRdID0gdmFsdWU7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmltcGxpZWRWYWx1ZXNbY29tcG9uZW50XTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGFkZER1cmF0aW9uQXNJbXBsaWVkKGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnREYXRlID0gdGhpcy5kYXRlV2l0aG91dFRpbWV6b25lQWRqdXN0bWVudCgpO1xuICAgICAgICBjb25zdCBkYXRlID0gYWRkRHVyYXRpb24oY3VycmVudERhdGUsIGR1cmF0aW9uKTtcbiAgICAgICAgaWYgKFwiZGF5XCIgaW4gZHVyYXRpb24gfHwgXCJ3ZWVrXCIgaW4gZHVyYXRpb24gfHwgXCJtb250aFwiIGluIGR1cmF0aW9uIHx8IFwieWVhclwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZShbXCJkYXlcIiwgXCJ3ZWVrZGF5XCIsIFwibW9udGhcIiwgXCJ5ZWFyXCJdKTtcbiAgICAgICAgICAgIHRoaXMuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgdGhpcy5pbXBseShcIndlZWtkYXlcIiwgZGF0ZS5nZXREYXkoKSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcInNlY29uZFwiIGluIGR1cmF0aW9uIHx8IFwibWludXRlXCIgaW4gZHVyYXRpb24gfHwgXCJob3VyXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlKFtcInNlY29uZFwiLCBcIm1pbnV0ZVwiLCBcImhvdXJcIl0pO1xuICAgICAgICAgICAgdGhpcy5pbXBseShcInNlY29uZFwiLCBkYXRlLmdldFNlY29uZHMoKSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwibWludXRlXCIsIGRhdGUuZ2V0TWludXRlcygpKTtcbiAgICAgICAgICAgIHRoaXMuaW1wbHkoXCJob3VyXCIsIGRhdGUuZ2V0SG91cnMoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGRlbGV0ZShjb21wb25lbnRzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50cyA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgY29tcG9uZW50cyA9IFtjb21wb25lbnRzXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudCBvZiBjb21wb25lbnRzKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5rbm93blZhbHVlc1tjb21wb25lbnRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuaW1wbGllZFZhbHVlc1tjb21wb25lbnRdO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHModGhpcy5yZWZlcmVuY2UpO1xuICAgICAgICBjb21wb25lbnQua25vd25WYWx1ZXMgPSB7fTtcbiAgICAgICAgY29tcG9uZW50LmltcGxpZWRWYWx1ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5rbm93blZhbHVlcykge1xuICAgICAgICAgICAgY29tcG9uZW50Lmtub3duVmFsdWVzW2tleV0gPSB0aGlzLmtub3duVmFsdWVzW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5pbXBsaWVkVmFsdWVzKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuaW1wbGllZFZhbHVlc1trZXldID0gdGhpcy5pbXBsaWVkVmFsdWVzW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG4gICAgaXNPbmx5RGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLmlzQ2VydGFpbihcImhvdXJcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwibWludXRlXCIpICYmICF0aGlzLmlzQ2VydGFpbihcInNlY29uZFwiKTtcbiAgICB9XG4gICAgaXNPbmx5VGltZSgpIHtcbiAgICAgICAgcmV0dXJuICghdGhpcy5pc0NlcnRhaW4oXCJ3ZWVrZGF5XCIpICYmICF0aGlzLmlzQ2VydGFpbihcImRheVwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJtb250aFwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJ5ZWFyXCIpKTtcbiAgICB9XG4gICAgaXNPbmx5V2Vla2RheUNvbXBvbmVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNDZXJ0YWluKFwid2Vla2RheVwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJkYXlcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwibW9udGhcIik7XG4gICAgfVxuICAgIGlzRGF0ZVdpdGhVbmtub3duWWVhcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNDZXJ0YWluKFwibW9udGhcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwieWVhclwiKTtcbiAgICB9XG4gICAgaXNWYWxpZERhdGUoKSB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSB0aGlzLmRhdGVXaXRob3V0VGltZXpvbmVBZGp1c3RtZW50KCk7XG4gICAgICAgIGlmIChkYXRlLmdldEZ1bGxZZWFyKCkgIT09IHRoaXMuZ2V0KFwieWVhclwiKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGRhdGUuZ2V0TW9udGgoKSAhPT0gdGhpcy5nZXQoXCJtb250aFwiKSAtIDEpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChkYXRlLmdldERhdGUoKSAhPT0gdGhpcy5nZXQoXCJkYXlcIikpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLmdldChcImhvdXJcIikgIT0gbnVsbCAmJiBkYXRlLmdldEhvdXJzKCkgIT0gdGhpcy5nZXQoXCJob3VyXCIpKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5nZXQoXCJtaW51dGVcIikgIT0gbnVsbCAmJiBkYXRlLmdldE1pbnV0ZXMoKSAhPSB0aGlzLmdldChcIm1pbnV0ZVwiKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFtQYXJzaW5nQ29tcG9uZW50cyB7XG4gICAgICAgICAgICB0YWdzOiAke0pTT04uc3RyaW5naWZ5KEFycmF5LmZyb20odGhpcy5fdGFncykuc29ydCgpKX0sIFxuICAgICAgICAgICAga25vd25WYWx1ZXM6ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5rbm93blZhbHVlcyl9LCBcbiAgICAgICAgICAgIGltcGxpZWRWYWx1ZXM6ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5pbXBsaWVkVmFsdWVzKX19LCBcbiAgICAgICAgICAgIHJlZmVyZW5jZTogJHtKU09OLnN0cmluZ2lmeSh0aGlzLnJlZmVyZW5jZSl9XWA7XG4gICAgfVxuICAgIGRhdGUoKSB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSB0aGlzLmRhdGVXaXRob3V0VGltZXpvbmVBZGp1c3RtZW50KCk7XG4gICAgICAgIGNvbnN0IHRpbWV6b25lQWRqdXN0bWVudCA9IHRoaXMucmVmZXJlbmNlLmdldFN5c3RlbVRpbWV6b25lQWRqdXN0bWVudE1pbnV0ZShkYXRlLCB0aGlzLmdldChcInRpbWV6b25lT2Zmc2V0XCIpKTtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKGRhdGUuZ2V0VGltZSgpICsgdGltZXpvbmVBZGp1c3RtZW50ICogNjAwMDApO1xuICAgIH1cbiAgICBhZGRUYWcodGFnKSB7XG4gICAgICAgIHRoaXMuX3RhZ3MuYWRkKHRhZyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBhZGRUYWdzKHRhZ3MpIHtcbiAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgICAgICAgICAgdGhpcy5fdGFncy5hZGQodGFnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGFncygpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBTZXQodGhpcy5fdGFncyk7XG4gICAgfVxuICAgIGRhdGVXaXRob3V0VGltZXpvbmVBZGp1c3RtZW50KCkge1xuICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUodGhpcy5nZXQoXCJ5ZWFyXCIpLCB0aGlzLmdldChcIm1vbnRoXCIpIC0gMSwgdGhpcy5nZXQoXCJkYXlcIiksIHRoaXMuZ2V0KFwiaG91clwiKSwgdGhpcy5nZXQoXCJtaW51dGVcIiksIHRoaXMuZ2V0KFwic2Vjb25kXCIpLCB0aGlzLmdldChcIm1pbGxpc2Vjb25kXCIpKTtcbiAgICAgICAgZGF0ZS5zZXRGdWxsWWVhcih0aGlzLmdldChcInllYXJcIikpO1xuICAgICAgICByZXR1cm4gZGF0ZTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUGFyc2luZ1Jlc3VsdCB7XG4gICAgcmVmRGF0ZTtcbiAgICBpbmRleDtcbiAgICB0ZXh0O1xuICAgIHJlZmVyZW5jZTtcbiAgICBzdGFydDtcbiAgICBlbmQ7XG4gICAgY29uc3RydWN0b3IocmVmZXJlbmNlLCBpbmRleCwgdGV4dCwgc3RhcnQsIGVuZCkge1xuICAgICAgICB0aGlzLnJlZmVyZW5jZSA9IHJlZmVyZW5jZTtcbiAgICAgICAgdGhpcy5yZWZEYXRlID0gcmVmZXJlbmNlLmluc3RhbnQ7XG4gICAgICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy50ZXh0ID0gdGV4dDtcbiAgICAgICAgdGhpcy5zdGFydCA9IHN0YXJ0IHx8IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UpO1xuICAgICAgICB0aGlzLmVuZCA9IGVuZDtcbiAgICB9XG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBQYXJzaW5nUmVzdWx0KHRoaXMucmVmZXJlbmNlLCB0aGlzLmluZGV4LCB0aGlzLnRleHQpO1xuICAgICAgICByZXN1bHQuc3RhcnQgPSB0aGlzLnN0YXJ0ID8gdGhpcy5zdGFydC5jbG9uZSgpIDogbnVsbDtcbiAgICAgICAgcmVzdWx0LmVuZCA9IHRoaXMuZW5kID8gdGhpcy5lbmQuY2xvbmUoKSA6IG51bGw7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGRhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXJ0LmRhdGUoKTtcbiAgICB9XG4gICAgYWRkVGFnKHRhZykge1xuICAgICAgICB0aGlzLnN0YXJ0LmFkZFRhZyh0YWcpO1xuICAgICAgICBpZiAodGhpcy5lbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5kLmFkZFRhZyh0YWcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBhZGRUYWdzKHRhZ3MpIHtcbiAgICAgICAgdGhpcy5zdGFydC5hZGRUYWdzKHRhZ3MpO1xuICAgICAgICBpZiAodGhpcy5lbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5kLmFkZFRhZ3ModGFncyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHRhZ3MoKSB7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkVGFncyA9IG5ldyBTZXQodGhpcy5zdGFydC50YWdzKCkpO1xuICAgICAgICBpZiAodGhpcy5lbmQpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRoaXMuZW5kLnRhZ3MoKSkge1xuICAgICAgICAgICAgICAgIGNvbWJpbmVkVGFncy5hZGQodGFnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tYmluZWRUYWdzO1xuICAgIH1cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgY29uc3QgdGFncyA9IEFycmF5LmZyb20odGhpcy50YWdzKCkpLnNvcnQoKTtcbiAgICAgICAgcmV0dXJuIGBbUGFyc2luZ1Jlc3VsdCB7aW5kZXg6ICR7dGhpcy5pbmRleH0sIHRleHQ6ICcke3RoaXMudGV4dH0nLCB0YWdzOiAke0pTT04uc3RyaW5naWZ5KHRhZ3MpfSAuLi59XWA7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cmVzdWx0cy5qcy5tYXAiLCJleHBvcnQgZnVuY3Rpb24gcmVwZWF0ZWRUaW1ldW5pdFBhdHRlcm4ocHJlZml4LCBzaW5nbGVUaW1ldW5pdFBhdHRlcm4sIGNvbm5lY3RvclBhdHRlcm4gPSBcIlxcXFxzezAsNX0sP1xcXFxzezAsNX1cIikge1xuICAgIGNvbnN0IHNpbmdsZVRpbWV1bml0UGF0dGVybk5vQ2FwdHVyZSA9IHNpbmdsZVRpbWV1bml0UGF0dGVybi5yZXBsYWNlKC9cXCgoPyFcXD8pL2csIFwiKD86XCIpO1xuICAgIHJldHVybiBgJHtwcmVmaXh9JHtzaW5nbGVUaW1ldW5pdFBhdHRlcm5Ob0NhcHR1cmV9KD86JHtjb25uZWN0b3JQYXR0ZXJufSR7c2luZ2xlVGltZXVuaXRQYXR0ZXJuTm9DYXB0dXJlfSl7MCwxMH1gO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RUZXJtcyhkaWN0aW9uYXJ5KSB7XG4gICAgbGV0IGtleXM7XG4gICAgaWYgKGRpY3Rpb25hcnkgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBrZXlzID0gWy4uLmRpY3Rpb25hcnldO1xuICAgIH1cbiAgICBlbHNlIGlmIChkaWN0aW9uYXJ5IGluc3RhbmNlb2YgTWFwKSB7XG4gICAgICAgIGtleXMgPSBBcnJheS5mcm9tKGRpY3Rpb25hcnkua2V5cygpKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhkaWN0aW9uYXJ5KTtcbiAgICB9XG4gICAgcmV0dXJuIGtleXM7XG59XG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hBbnlQYXR0ZXJuKGRpY3Rpb25hcnkpIHtcbiAgICBjb25zdCBqb2luZWRUZXJtcyA9IGV4dHJhY3RUZXJtcyhkaWN0aW9uYXJ5KVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aClcbiAgICAgICAgLmpvaW4oXCJ8XCIpXG4gICAgICAgIC5yZXBsYWNlKC9cXC4vZywgXCJcXFxcLlwiKTtcbiAgICByZXR1cm4gYCg/OiR7am9pbmVkVGVybXN9KWA7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYXR0ZXJuLmpzLm1hcCIsImltcG9ydCB7IGFkZER1cmF0aW9uIH0gZnJvbSBcIi4vZHVyYXRpb24uanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBmaW5kTW9zdExpa2VseUFEWWVhcih5ZWFyTnVtYmVyKSB7XG4gICAgaWYgKHllYXJOdW1iZXIgPCAxMDApIHtcbiAgICAgICAgaWYgKHllYXJOdW1iZXIgPiA1MCkge1xuICAgICAgICAgICAgeWVhck51bWJlciA9IHllYXJOdW1iZXIgKyAxOTAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgeWVhck51bWJlciA9IHllYXJOdW1iZXIgKyAyMDAwO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB5ZWFyTnVtYmVyO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRZZWFyQ2xvc2VzdFRvUmVmKHJlZkRhdGUsIGRheSwgbW9udGgpIHtcbiAgICBsZXQgZGF0ZSA9IG5ldyBEYXRlKHJlZkRhdGUpO1xuICAgIGRhdGUuc2V0TW9udGgobW9udGggLSAxKTtcbiAgICBkYXRlLnNldERhdGUoZGF5KTtcbiAgICBjb25zdCBuZXh0WWVhciA9IGFkZER1cmF0aW9uKGRhdGUsIHsgXCJ5ZWFyXCI6IDEgfSk7XG4gICAgY29uc3QgbGFzdFllYXIgPSBhZGREdXJhdGlvbihkYXRlLCB7IFwieWVhclwiOiAtMSB9KTtcbiAgICBpZiAoTWF0aC5hYnMobmV4dFllYXIuZ2V0VGltZSgpIC0gcmVmRGF0ZS5nZXRUaW1lKCkpIDwgTWF0aC5hYnMoZGF0ZS5nZXRUaW1lKCkgLSByZWZEYXRlLmdldFRpbWUoKSkpIHtcbiAgICAgICAgZGF0ZSA9IG5leHRZZWFyO1xuICAgIH1cbiAgICBlbHNlIGlmIChNYXRoLmFicyhsYXN0WWVhci5nZXRUaW1lKCkgLSByZWZEYXRlLmdldFRpbWUoKSkgPCBNYXRoLmFicyhkYXRlLmdldFRpbWUoKSAtIHJlZkRhdGUuZ2V0VGltZSgpKSkge1xuICAgICAgICBkYXRlID0gbGFzdFllYXI7XG4gICAgfVxuICAgIHJldHVybiBkYXRlLmdldEZ1bGxZZWFyKCk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD15ZWFycy5qcy5tYXAiLCJpbXBvcnQgeyBtYXRjaEFueVBhdHRlcm4sIHJlcGVhdGVkVGltZXVuaXRQYXR0ZXJuIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3BhdHRlcm4uanNcIjtcbmltcG9ydCB7IGZpbmRNb3N0TGlrZWx5QURZZWFyIH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5leHBvcnQgY29uc3QgV0VFS0RBWV9ESUNUSU9OQVJZID0ge1xuICAgIHN1bmRheTogMCxcbiAgICBzdW46IDAsXG4gICAgXCJzdW4uXCI6IDAsXG4gICAgbW9uZGF5OiAxLFxuICAgIG1vbjogMSxcbiAgICBcIm1vbi5cIjogMSxcbiAgICB0dWVzZGF5OiAyLFxuICAgIHR1ZTogMixcbiAgICBcInR1ZS5cIjogMixcbiAgICB3ZWRuZXNkYXk6IDMsXG4gICAgd2VkOiAzLFxuICAgIFwid2VkLlwiOiAzLFxuICAgIHRodXJzZGF5OiA0LFxuICAgIHRodXJzOiA0LFxuICAgIFwidGh1cnMuXCI6IDQsXG4gICAgdGh1cjogNCxcbiAgICBcInRodXIuXCI6IDQsXG4gICAgdGh1OiA0LFxuICAgIFwidGh1LlwiOiA0LFxuICAgIGZyaWRheTogNSxcbiAgICBmcmk6IDUsXG4gICAgXCJmcmkuXCI6IDUsXG4gICAgc2F0dXJkYXk6IDYsXG4gICAgc2F0OiA2LFxuICAgIFwic2F0LlwiOiA2LFxufTtcbmV4cG9ydCBjb25zdCBGVUxMX01PTlRIX05BTUVfRElDVElPTkFSWSA9IHtcbiAgICBqYW51YXJ5OiAxLFxuICAgIGZlYnJ1YXJ5OiAyLFxuICAgIG1hcmNoOiAzLFxuICAgIGFwcmlsOiA0LFxuICAgIG1heTogNSxcbiAgICBqdW5lOiA2LFxuICAgIGp1bHk6IDcsXG4gICAgYXVndXN0OiA4LFxuICAgIHNlcHRlbWJlcjogOSxcbiAgICBvY3RvYmVyOiAxMCxcbiAgICBub3ZlbWJlcjogMTEsXG4gICAgZGVjZW1iZXI6IDEyLFxufTtcbmV4cG9ydCBjb25zdCBNT05USF9ESUNUSU9OQVJZID0ge1xuICAgIC4uLkZVTExfTU9OVEhfTkFNRV9ESUNUSU9OQVJZLFxuICAgIGphbjogMSxcbiAgICBcImphbi5cIjogMSxcbiAgICBmZWI6IDIsXG4gICAgXCJmZWIuXCI6IDIsXG4gICAgbWFyOiAzLFxuICAgIFwibWFyLlwiOiAzLFxuICAgIGFwcjogNCxcbiAgICBcImFwci5cIjogNCxcbiAgICBqdW46IDYsXG4gICAgXCJqdW4uXCI6IDYsXG4gICAganVsOiA3LFxuICAgIFwianVsLlwiOiA3LFxuICAgIGF1ZzogOCxcbiAgICBcImF1Zy5cIjogOCxcbiAgICBzZXA6IDksXG4gICAgXCJzZXAuXCI6IDksXG4gICAgc2VwdDogOSxcbiAgICBcInNlcHQuXCI6IDksXG4gICAgb2N0OiAxMCxcbiAgICBcIm9jdC5cIjogMTAsXG4gICAgbm92OiAxMSxcbiAgICBcIm5vdi5cIjogMTEsXG4gICAgZGVjOiAxMixcbiAgICBcImRlYy5cIjogMTIsXG59O1xuZXhwb3J0IGNvbnN0IElOVEVHRVJfV09SRF9ESUNUSU9OQVJZID0ge1xuICAgIG9uZTogMSxcbiAgICB0d286IDIsXG4gICAgdGhyZWU6IDMsXG4gICAgZm91cjogNCxcbiAgICBmaXZlOiA1LFxuICAgIHNpeDogNixcbiAgICBzZXZlbjogNyxcbiAgICBlaWdodDogOCxcbiAgICBuaW5lOiA5LFxuICAgIHRlbjogMTAsXG4gICAgZWxldmVuOiAxMSxcbiAgICB0d2VsdmU6IDEyLFxufTtcbmV4cG9ydCBjb25zdCBPUkRJTkFMX1dPUkRfRElDVElPTkFSWSA9IHtcbiAgICBmaXJzdDogMSxcbiAgICBzZWNvbmQ6IDIsXG4gICAgdGhpcmQ6IDMsXG4gICAgZm91cnRoOiA0LFxuICAgIGZpZnRoOiA1LFxuICAgIHNpeHRoOiA2LFxuICAgIHNldmVudGg6IDcsXG4gICAgZWlnaHRoOiA4LFxuICAgIG5pbnRoOiA5LFxuICAgIHRlbnRoOiAxMCxcbiAgICBlbGV2ZW50aDogMTEsXG4gICAgdHdlbGZ0aDogMTIsXG4gICAgdGhpcnRlZW50aDogMTMsXG4gICAgZm91cnRlZW50aDogMTQsXG4gICAgZmlmdGVlbnRoOiAxNSxcbiAgICBzaXh0ZWVudGg6IDE2LFxuICAgIHNldmVudGVlbnRoOiAxNyxcbiAgICBlaWdodGVlbnRoOiAxOCxcbiAgICBuaW5ldGVlbnRoOiAxOSxcbiAgICB0d2VudGlldGg6IDIwLFxuICAgIFwidHdlbnR5IGZpcnN0XCI6IDIxLFxuICAgIFwidHdlbnR5LWZpcnN0XCI6IDIxLFxuICAgIFwidHdlbnR5IHNlY29uZFwiOiAyMixcbiAgICBcInR3ZW50eS1zZWNvbmRcIjogMjIsXG4gICAgXCJ0d2VudHkgdGhpcmRcIjogMjMsXG4gICAgXCJ0d2VudHktdGhpcmRcIjogMjMsXG4gICAgXCJ0d2VudHkgZm91cnRoXCI6IDI0LFxuICAgIFwidHdlbnR5LWZvdXJ0aFwiOiAyNCxcbiAgICBcInR3ZW50eSBmaWZ0aFwiOiAyNSxcbiAgICBcInR3ZW50eS1maWZ0aFwiOiAyNSxcbiAgICBcInR3ZW50eSBzaXh0aFwiOiAyNixcbiAgICBcInR3ZW50eS1zaXh0aFwiOiAyNixcbiAgICBcInR3ZW50eSBzZXZlbnRoXCI6IDI3LFxuICAgIFwidHdlbnR5LXNldmVudGhcIjogMjcsXG4gICAgXCJ0d2VudHkgZWlnaHRoXCI6IDI4LFxuICAgIFwidHdlbnR5LWVpZ2h0aFwiOiAyOCxcbiAgICBcInR3ZW50eSBuaW50aFwiOiAyOSxcbiAgICBcInR3ZW50eS1uaW50aFwiOiAyOSxcbiAgICBcInRoaXJ0aWV0aFwiOiAzMCxcbiAgICBcInRoaXJ0eSBmaXJzdFwiOiAzMSxcbiAgICBcInRoaXJ0eS1maXJzdFwiOiAzMSxcbn07XG5leHBvcnQgY29uc3QgVElNRV9VTklUX0RJQ1RJT05BUllfTk9fQUJCUiA9IHtcbiAgICBzZWNvbmQ6IFwic2Vjb25kXCIsXG4gICAgc2Vjb25kczogXCJzZWNvbmRcIixcbiAgICBtaW51dGU6IFwibWludXRlXCIsXG4gICAgbWludXRlczogXCJtaW51dGVcIixcbiAgICBob3VyOiBcImhvdXJcIixcbiAgICBob3VyczogXCJob3VyXCIsXG4gICAgZGF5OiBcImRheVwiLFxuICAgIGRheXM6IFwiZGF5XCIsXG4gICAgd2VlazogXCJ3ZWVrXCIsXG4gICAgd2Vla3M6IFwid2Vla1wiLFxuICAgIG1vbnRoOiBcIm1vbnRoXCIsXG4gICAgbW9udGhzOiBcIm1vbnRoXCIsXG4gICAgcXVhcnRlcjogXCJxdWFydGVyXCIsXG4gICAgcXVhcnRlcnM6IFwicXVhcnRlclwiLFxuICAgIHllYXI6IFwieWVhclwiLFxuICAgIHllYXJzOiBcInllYXJcIixcbn07XG5leHBvcnQgY29uc3QgVElNRV9VTklUX0RJQ1RJT05BUlkgPSB7XG4gICAgczogXCJzZWNvbmRcIixcbiAgICBzZWM6IFwic2Vjb25kXCIsXG4gICAgc2Vjb25kOiBcInNlY29uZFwiLFxuICAgIHNlY29uZHM6IFwic2Vjb25kXCIsXG4gICAgbTogXCJtaW51dGVcIixcbiAgICBtaW46IFwibWludXRlXCIsXG4gICAgbWluczogXCJtaW51dGVcIixcbiAgICBtaW51dGU6IFwibWludXRlXCIsXG4gICAgbWludXRlczogXCJtaW51dGVcIixcbiAgICBoOiBcImhvdXJcIixcbiAgICBocjogXCJob3VyXCIsXG4gICAgaHJzOiBcImhvdXJcIixcbiAgICBob3VyOiBcImhvdXJcIixcbiAgICBob3VyczogXCJob3VyXCIsXG4gICAgZDogXCJkYXlcIixcbiAgICBkYXk6IFwiZGF5XCIsXG4gICAgZGF5czogXCJkYXlcIixcbiAgICB3OiBcIndlZWtcIixcbiAgICB3ZWVrOiBcIndlZWtcIixcbiAgICB3ZWVrczogXCJ3ZWVrXCIsXG4gICAgbW86IFwibW9udGhcIixcbiAgICBtb246IFwibW9udGhcIixcbiAgICBtb3M6IFwibW9udGhcIixcbiAgICBtb250aDogXCJtb250aFwiLFxuICAgIG1vbnRoczogXCJtb250aFwiLFxuICAgIHF0cjogXCJxdWFydGVyXCIsXG4gICAgcXVhcnRlcjogXCJxdWFydGVyXCIsXG4gICAgcXVhcnRlcnM6IFwicXVhcnRlclwiLFxuICAgIHk6IFwieWVhclwiLFxuICAgIHlyOiBcInllYXJcIixcbiAgICB5ZWFyOiBcInllYXJcIixcbiAgICB5ZWFyczogXCJ5ZWFyXCIsXG4gICAgLi4uVElNRV9VTklUX0RJQ1RJT05BUllfTk9fQUJCUixcbn07XG5leHBvcnQgY29uc3QgTlVNQkVSX1BBVFRFUk4gPSBgKD86JHttYXRjaEFueVBhdHRlcm4oSU5URUdFUl9XT1JEX0RJQ1RJT05BUlkpfXxbMC05XSt8WzAtOV0rXFxcXC5bMC05XSt8aGFsZig/OlxcXFxzezAsMn1hbj8pP3xhbj9cXFxcYig/OlxcXFxzezAsMn1mZXcpP3xmZXd8c2V2ZXJhbHx0aGV8YT9cXFxcc3swLDJ9Y291cGxlXFxcXHN7MCwyfSg/Om9mKT8pYDtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU51bWJlclBhdHRlcm4obWF0Y2gpIHtcbiAgICBjb25zdCBudW0gPSBtYXRjaC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChJTlRFR0VSX1dPUkRfRElDVElPTkFSWVtudW1dICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIElOVEVHRVJfV09SRF9ESUNUSU9OQVJZW251bV07XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bSA9PT0gXCJhXCIgfHwgbnVtID09PSBcImFuXCIgfHwgbnVtID09IFwidGhlXCIpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvZmV3LykpIHtcbiAgICAgICAgcmV0dXJuIDM7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvaGFsZi8pKSB7XG4gICAgICAgIHJldHVybiAwLjU7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvY291cGxlLykpIHtcbiAgICAgICAgcmV0dXJuIDI7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvc2V2ZXJhbC8pKSB7XG4gICAgICAgIHJldHVybiA3O1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VGbG9hdChudW0pO1xufVxuZXhwb3J0IGNvbnN0IE9SRElOQUxfTlVNQkVSX1BBVFRFUk4gPSBgKD86JHttYXRjaEFueVBhdHRlcm4oT1JESU5BTF9XT1JEX0RJQ1RJT05BUlkpfXxbMC05XXsxLDJ9KD86c3R8bmR8cmR8dGgpPylgO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlT3JkaW5hbE51bWJlclBhdHRlcm4obWF0Y2gpIHtcbiAgICBsZXQgbnVtID0gbWF0Y2gudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoT1JESU5BTF9XT1JEX0RJQ1RJT05BUllbbnVtXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBPUkRJTkFMX1dPUkRfRElDVElPTkFSWVtudW1dO1xuICAgIH1cbiAgICBudW0gPSBudW0ucmVwbGFjZSgvKD86c3R8bmR8cmR8dGgpJC9pLCBcIlwiKTtcbiAgICByZXR1cm4gcGFyc2VJbnQobnVtKTtcbn1cbmV4cG9ydCBjb25zdCBZRUFSX1BBVFRFUk4gPSBgKD86WzEtOV1bMC05XXswLDN9XFxcXHN7MCwyfSg/OkJFfEFEfEJDfEJDRXxDRSl8WzEtOV1bMC05XXszfXxbNS05XVswLTldfDJbMC01XSlgO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlWWVhcihtYXRjaCkge1xuICAgIGlmICgvQkUvaS50ZXN0KG1hdGNoKSkge1xuICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoL0JFL2ksIFwiXCIpO1xuICAgICAgICByZXR1cm4gcGFyc2VJbnQobWF0Y2gpIC0gNTQzO1xuICAgIH1cbiAgICBpZiAoL0JDRT8vaS50ZXN0KG1hdGNoKSkge1xuICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoL0JDRT8vaSwgXCJcIik7XG4gICAgICAgIHJldHVybiAtcGFyc2VJbnQobWF0Y2gpO1xuICAgIH1cbiAgICBpZiAoLyhBRHxDRSkvaS50ZXN0KG1hdGNoKSkge1xuICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoLyhBRHxDRSkvaSwgXCJcIik7XG4gICAgICAgIHJldHVybiBwYXJzZUludChtYXRjaCk7XG4gICAgfVxuICAgIGNvbnN0IHJhd1llYXJOdW1iZXIgPSBwYXJzZUludChtYXRjaCk7XG4gICAgcmV0dXJuIGZpbmRNb3N0TGlrZWx5QURZZWFyKHJhd1llYXJOdW1iZXIpO1xufVxuY29uc3QgU0lOR0xFX1RJTUVfVU5JVF9QQVRURVJOID0gYCgke05VTUJFUl9QQVRURVJOfSlcXFxcc3swLDN9KCR7bWF0Y2hBbnlQYXR0ZXJuKFRJTUVfVU5JVF9ESUNUSU9OQVJZKX0pYDtcbmNvbnN0IFNJTkdMRV9USU1FX1VOSVRfUkVHRVggPSBuZXcgUmVnRXhwKFNJTkdMRV9USU1FX1VOSVRfUEFUVEVSTiwgXCJpXCIpO1xuY29uc3QgU0lOR0xFX1RJTUVfVU5JVF9OT19BQkJSX1BBVFRFUk4gPSBgKCR7TlVNQkVSX1BBVFRFUk59KVxcXFxzezAsM30oJHttYXRjaEFueVBhdHRlcm4oVElNRV9VTklUX0RJQ1RJT05BUllfTk9fQUJCUil9KWA7XG5jb25zdCBUSU1FX1VOSVRfQ09OTkVDVE9SX1BBVFRFUk4gPSBgXFxcXHN7MCw1fSw/KD86XFxcXHMqYW5kKT9cXFxcc3swLDV9YDtcbmV4cG9ydCBjb25zdCBUSU1FX1VOSVRTX1BBVFRFUk4gPSByZXBlYXRlZFRpbWV1bml0UGF0dGVybihgKD86KD86YWJvdXR8YXJvdW5kKVxcXFxzezAsM30pP2AsIFNJTkdMRV9USU1FX1VOSVRfUEFUVEVSTiwgVElNRV9VTklUX0NPTk5FQ1RPUl9QQVRURVJOKTtcbmV4cG9ydCBjb25zdCBUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTiA9IHJlcGVhdGVkVGltZXVuaXRQYXR0ZXJuKGAoPzooPzphYm91dHxhcm91bmQpXFxcXHN7MCwzfSk/YCwgU0lOR0xFX1RJTUVfVU5JVF9OT19BQkJSX1BBVFRFUk4sIFRJTUVfVU5JVF9DT05ORUNUT1JfUEFUVEVSTik7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VEdXJhdGlvbih0aW1ldW5pdFRleHQpIHtcbiAgICBjb25zdCBmcmFnbWVudHMgPSB7fTtcbiAgICBsZXQgcmVtYWluaW5nVGV4dCA9IHRpbWV1bml0VGV4dDtcbiAgICBsZXQgbWF0Y2ggPSBTSU5HTEVfVElNRV9VTklUX1JFR0VYLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgd2hpbGUgKG1hdGNoKSB7XG4gICAgICAgIGNvbGxlY3REYXRlVGltZUZyYWdtZW50KGZyYWdtZW50cywgbWF0Y2gpO1xuICAgICAgICByZW1haW5pbmdUZXh0ID0gcmVtYWluaW5nVGV4dC5zdWJzdHJpbmcobWF0Y2hbMF0ubGVuZ3RoKS50cmltKCk7XG4gICAgICAgIG1hdGNoID0gU0lOR0xFX1RJTUVfVU5JVF9SRUdFWC5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmtleXMoZnJhZ21lbnRzKS5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50cztcbn1cbmZ1bmN0aW9uIGNvbGxlY3REYXRlVGltZUZyYWdtZW50KGZyYWdtZW50cywgbWF0Y2gpIHtcbiAgICBpZiAobWF0Y2hbMF0ubWF0Y2goL15bYS16QS1aXSskLykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBudW0gPSBwYXJzZU51bWJlclBhdHRlcm4obWF0Y2hbMV0pO1xuICAgIGNvbnN0IHVuaXQgPSBUSU1FX1VOSVRfRElDVElPTkFSWVttYXRjaFsyXS50b0xvd2VyQ2FzZSgpXTtcbiAgICBmcmFnbWVudHNbdW5pdF0gPSBudW07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb25zdGFudHMuanMubWFwIiwiZXhwb3J0IGNsYXNzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm5IYXNDaGFuZ2UoY29udGV4dCwgY3VycmVudElubmVyUGF0dGVybikge1xuICAgICAgICByZXR1cm4gdGhpcy5pbm5lclBhdHRlcm4oY29udGV4dCkgIT09IGN1cnJlbnRJbm5lclBhdHRlcm47XG4gICAgfVxuICAgIHBhdHRlcm5MZWZ0Qm91bmRhcnkoKSB7XG4gICAgICAgIHJldHVybiBgKFxcXFxXfF4pYDtcbiAgICB9XG4gICAgY2FjaGVkSW5uZXJQYXR0ZXJuID0gbnVsbDtcbiAgICBjYWNoZWRQYXR0ZXJuID0gbnVsbDtcbiAgICBwYXR0ZXJuKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVkSW5uZXJQYXR0ZXJuKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaW5uZXJQYXR0ZXJuSGFzQ2hhbmdlKGNvbnRleHQsIHRoaXMuY2FjaGVkSW5uZXJQYXR0ZXJuKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFBhdHRlcm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jYWNoZWRJbm5lclBhdHRlcm4gPSB0aGlzLmlubmVyUGF0dGVybihjb250ZXh0KTtcbiAgICAgICAgdGhpcy5jYWNoZWRQYXR0ZXJuID0gbmV3IFJlZ0V4cChgJHt0aGlzLnBhdHRlcm5MZWZ0Qm91bmRhcnkoKX0ke3RoaXMuY2FjaGVkSW5uZXJQYXR0ZXJuLnNvdXJjZX1gLCB0aGlzLmNhY2hlZElubmVyUGF0dGVybi5mbGFncyk7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFBhdHRlcm47XG4gICAgfVxuICAgIGV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgaGVhZGVyID0gbWF0Y2hbMV0gPz8gXCJcIjtcbiAgICAgICAgbWF0Y2guaW5kZXggPSBtYXRjaC5pbmRleCArIGhlYWRlci5sZW5ndGg7XG4gICAgICAgIG1hdGNoWzBdID0gbWF0Y2hbMF0uc3Vic3RyaW5nKGhlYWRlci5sZW5ndGgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMjsgaSA8IG1hdGNoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBtYXRjaFtpIC0gMV0gPSBtYXRjaFtpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qcy5tYXAiLCJpbXBvcnQgeyBUSU1FX1VOSVRTX1BBVFRFUk4sIHBhcnNlRHVyYXRpb24sIFRJTUVfVU5JVFNfTk9fQUJCUl9QQVRURVJOIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgUGFyc2luZ0NvbXBvbmVudHMgfSBmcm9tIFwiLi4vLi4vLi4vcmVzdWx0cy5qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBQQVRURVJOX1dJVEhfT1BUSU9OQUxfUFJFRklYID0gbmV3IFJlZ0V4cChgKD86KD86d2l0aGlufGlufGZvcilcXFxccyopP2AgK1xuICAgIGAoPzooPzphYm91dHxhcm91bmR8cm91Z2hseXxhcHByb3hpbWF0ZWx5fGp1c3QpXFxcXHMqKD86flxcXFxzKik/KT8oJHtUSU1FX1VOSVRTX1BBVFRFUk59KSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgUEFUVEVSTl9XSVRIX1BSRUZJWCA9IG5ldyBSZWdFeHAoYCg/OndpdGhpbnxpbnxmb3IpXFxcXHMqYCArXG4gICAgYCg/Oig/OmFib3V0fGFyb3VuZHxyb3VnaGx5fGFwcHJveGltYXRlbHl8anVzdClcXFxccyooPzp+XFxcXHMqKT8pPygke1RJTUVfVU5JVFNfUEFUVEVSTn0pKD89XFxcXFd8JClgLCBcImlcIik7XG5jb25zdCBQQVRURVJOX1dJVEhfUFJFRklYX1NUUklDVCA9IG5ldyBSZWdFeHAoYCg/OndpdGhpbnxpbnxmb3IpXFxcXHMqYCArXG4gICAgYCg/Oig/OmFib3V0fGFyb3VuZHxyb3VnaGx5fGFwcHJveGltYXRlbHl8anVzdClcXFxccyooPzp+XFxcXHMqKT8pPygke1RJTUVfVU5JVFNfTk9fQUJCUl9QQVRURVJOfSkoPz1cXFxcV3wkKWAsIFwiaVwiKTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZVVuaXRXaXRoaW5Gb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgc3RyaWN0TW9kZTtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLnN0cmljdE1vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBQQVRURVJOX1dJVEhfUFJFRklYX1NUUklDVDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGV4dC5vcHRpb24uZm9yd2FyZERhdGUgPyBQQVRURVJOX1dJVEhfT1BUSU9OQUxfUFJFRklYIDogUEFUVEVSTl9XSVRIX1BSRUZJWDtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGlmIChtYXRjaFswXS5tYXRjaCgvXmZvclxccyp0aGVcXHMqXFx3Ky8pKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0aW1lVW5pdHMgPSBwYXJzZUR1cmF0aW9uKG1hdGNoWzFdKTtcbiAgICAgICAgaWYgKCF0aW1lVW5pdHMpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHRpbWVVbml0cyk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5UaW1lVW5pdFdpdGhpbkZvcm1hdFBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBmaW5kWWVhckNsb3Nlc3RUb1JlZiB9IGZyb20gXCIuLi8uLi8uLi9jYWxjdWxhdGlvbi95ZWFycy5qc1wiO1xuaW1wb3J0IHsgTU9OVEhfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFlFQVJfUEFUVEVSTiwgcGFyc2VZZWFyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgT1JESU5BTF9OVU1CRVJfUEFUVEVSTiwgcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKGAoPzpvblxcXFxzezAsM30pP2AgK1xuICAgIGAoJHtPUkRJTkFMX05VTUJFUl9QQVRURVJOfSlgICtcbiAgICBgKD86YCArXG4gICAgYFxcXFxzezAsM30oPzp0b3xcXFxcLXxcXFxc4oCTfHVudGlsfHRocm91Z2h8dGlsbCk/XFxcXHN7MCwzfWAgK1xuICAgIGAoJHtPUkRJTkFMX05VTUJFUl9QQVRURVJOfSlgICtcbiAgICBcIik/XCIgK1xuICAgIGAoPzotfC98XFxcXHN7MCwzfSg/Om9mKT9cXFxcc3swLDN9KWAgK1xuICAgIGAoJHttYXRjaEFueVBhdHRlcm4oTU9OVEhfRElDVElPTkFSWSl9KWAgK1xuICAgIFwiKD86XCIgK1xuICAgIGAoPzotfC98LD9cXFxcc3swLDN9KWAgK1xuICAgIGAoJHtZRUFSX1BBVFRFUk59KD8hXFxcXHcpKWAgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBEQVRFX0dST1VQID0gMTtcbmNvbnN0IERBVEVfVE9fR1JPVVAgPSAyO1xuY29uc3QgTU9OVEhfTkFNRV9HUk9VUCA9IDM7XG5jb25zdCBZRUFSX0dST1VQID0gNDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTW9udGhOYW1lTGl0dGxlRW5kaWFuUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgY29uc3QgbW9udGggPSBNT05USF9ESUNUSU9OQVJZW21hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCldO1xuICAgICAgICBjb25zdCBkYXkgPSBwYXJzZU9yZGluYWxOdW1iZXJQYXR0ZXJuKG1hdGNoW0RBVEVfR1JPVVBdKTtcbiAgICAgICAgaWYgKGRheSA+IDMxKSB7XG4gICAgICAgICAgICBtYXRjaC5pbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbREFURV9HUk9VUF0ubGVuZ3RoO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIG1vbnRoKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXkpO1xuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXJOdW1iZXIgPSBwYXJzZVllYXIobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgeWVhck51bWJlcik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB5ZWFyID0gZmluZFllYXJDbG9zZXN0VG9SZWYoY29udGV4dC5yZWZEYXRlLCBkYXksIG1vbnRoKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgeWVhcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW0RBVEVfVE9fR1JPVVBdKSB7XG4gICAgICAgICAgICBjb25zdCBlbmREYXRlID0gcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybihtYXRjaFtEQVRFX1RPX0dST1VQXSk7XG4gICAgICAgICAgICByZXN1bHQuZW5kID0gcmVzdWx0LnN0YXJ0LmNsb25lKCk7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImRheVwiLCBlbmREYXRlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOTW9udGhOYW1lTGl0dGxlRW5kaWFuUGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IGZpbmRZZWFyQ2xvc2VzdFRvUmVmIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5pbXBvcnQgeyBNT05USF9ESUNUSU9OQVJZIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgT1JESU5BTF9OVU1CRVJfUEFUVEVSTiwgcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFlFQVJfUEFUVEVSTiwgcGFyc2VZZWFyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgbWF0Y2hBbnlQYXR0ZXJuIH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3BhdHRlcm4uanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCgke21hdGNoQW55UGF0dGVybihNT05USF9ESUNUSU9OQVJZKX0pYCArXG4gICAgXCIoPzotfC98XFxcXHMqLD9cXFxccyopXCIgK1xuICAgIGAoJHtPUkRJTkFMX05VTUJFUl9QQVRURVJOfSkoPyFcXFxccyooPzphbXxwbSkpXFxcXHMqYCArXG4gICAgXCIoPzpcIiArXG4gICAgXCIoPzp0b3xcXFxcLSlcXFxccypcIiArXG4gICAgYCgke09SRElOQUxfTlVNQkVSX1BBVFRFUk59KVxcXFxzKmAgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPzpcIiArXG4gICAgYCg/Oi18L3xcXFxccyosXFxcXHMqfFxcXFxzKylgICtcbiAgICBgKCR7WUVBUl9QQVRURVJOfSlgICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD89XFxcXFd8JCkoPyFcXFxcOlxcXFxkKVwiLCBcImlcIik7XG5jb25zdCBNT05USF9OQU1FX0dST1VQID0gMTtcbmNvbnN0IERBVEVfR1JPVVAgPSAyO1xuY29uc3QgREFURV9UT19HUk9VUCA9IDM7XG5jb25zdCBZRUFSX0dST1VQID0gNDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIHNob3VsZFNraXBZZWFyTGlrZURhdGU7XG4gICAgY29uc3RydWN0b3Ioc2hvdWxkU2tpcFllYXJMaWtlRGF0ZSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnNob3VsZFNraXBZZWFyTGlrZURhdGUgPSBzaG91bGRTa2lwWWVhckxpa2VEYXRlO1xuICAgIH1cbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgbW9udGggPSBNT05USF9ESUNUSU9OQVJZW21hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCldO1xuICAgICAgICBjb25zdCBkYXkgPSBwYXJzZU9yZGluYWxOdW1iZXJQYXR0ZXJuKG1hdGNoW0RBVEVfR1JPVVBdKTtcbiAgICAgICAgaWYgKGRheSA+IDMxKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zaG91bGRTa2lwWWVhckxpa2VEYXRlKSB7XG4gICAgICAgICAgICBpZiAoIW1hdGNoW0RBVEVfVE9fR1JPVVBdICYmICFtYXRjaFtZRUFSX0dST1VQXSAmJiBtYXRjaFtEQVRFX0dST1VQXS5tYXRjaCgvXjJbMC01XSQvKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0XG4gICAgICAgICAgICAuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoe1xuICAgICAgICAgICAgZGF5OiBkYXksXG4gICAgICAgICAgICBtb250aDogbW9udGgsXG4gICAgICAgIH0pXG4gICAgICAgICAgICAuYWRkVGFnKFwicGFyc2VyL0VOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyXCIpO1xuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZVllYXIobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IGZpbmRZZWFyQ2xvc2VzdFRvUmVmKGNvbnRleHQucmVmRGF0ZSwgZGF5LCBtb250aCk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1hdGNoW0RBVEVfVE9fR1JPVVBdKSB7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50cztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlbmREYXRlID0gcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybihtYXRjaFtEQVRFX1RPX0dST1VQXSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChtYXRjaC5pbmRleCwgbWF0Y2hbMF0pO1xuICAgICAgICByZXN1bHQuc3RhcnQgPSBjb21wb25lbnRzO1xuICAgICAgICByZXN1bHQuZW5kID0gY29tcG9uZW50cy5jbG9uZSgpO1xuICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImRheVwiLCBlbmREYXRlKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBGVUxMX01PTlRIX05BTUVfRElDVElPTkFSWSwgTU9OVEhfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IGZpbmRZZWFyQ2xvc2VzdFRvUmVmIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5pbXBvcnQgeyBtYXRjaEFueVBhdHRlcm4gfSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvcGF0dGVybi5qc1wiO1xuaW1wb3J0IHsgWUVBUl9QQVRURVJOLCBwYXJzZVllYXIgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKGAoKD86aW4pXFxcXHMqKT9gICtcbiAgICBgKCR7bWF0Y2hBbnlQYXR0ZXJuKE1PTlRIX0RJQ1RJT05BUlkpfSlgICtcbiAgICBgXFxcXHMqYCArXG4gICAgYCg/OmAgK1xuICAgIGAoPzosfC18b2YpP1xcXFxzKigke1lFQVJfUEFUVEVSTn0pP2AgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPz1bXlxcXFxzXFxcXHddfFxcXFxzK1teMC05XXxcXFxccyskfCQpXCIsIFwiaVwiKTtcbmNvbnN0IFBSRUZJWF9HUk9VUCA9IDE7XG5jb25zdCBNT05USF9OQU1FX0dST1VQID0gMjtcbmNvbnN0IFlFQVJfR1JPVVAgPSAzO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5Nb250aE5hbWVQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IG1vbnRoTmFtZSA9IG1hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChtYXRjaFswXS5sZW5ndGggPD0gMyAmJiAhRlVMTF9NT05USF9OQU1FX0RJQ1RJT05BUllbbW9udGhOYW1lXSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4ICsgKG1hdGNoW1BSRUZJWF9HUk9VUF0gfHwgXCJcIikubGVuZ3RoLCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCAxKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFkZFRhZyhcInBhcnNlci9FTk1vbnRoTmFtZVBhcnNlclwiKTtcbiAgICAgICAgY29uc3QgbW9udGggPSBNT05USF9ESUNUSU9OQVJZW21vbnRoTmFtZV07XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBtb250aCk7XG4gICAgICAgIGlmIChtYXRjaFtZRUFSX0dST1VQXSkge1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IHBhcnNlWWVhcihtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBmaW5kWWVhckNsb3Nlc3RUb1JlZihjb250ZXh0LnJlZkRhdGUsIDEsIG1vbnRoKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgeWVhcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1vbnRoTmFtZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBNT05USF9ESUNUSU9OQVJZIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgbWF0Y2hBbnlQYXR0ZXJuIH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3BhdHRlcm4uanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYChbMC05XXs0fSlbLVxcXFwuXFxcXC9cXFxcc11gICtcbiAgICBgKD86KCR7bWF0Y2hBbnlQYXR0ZXJuKE1PTlRIX0RJQ1RJT05BUlkpfSl8KFswLTldezEsMn0pKVstXFxcXC5cXFxcL1xcXFxzXWAgK1xuICAgIGAoWzAtOV17MSwyfSlgICtcbiAgICBcIig/PVxcXFxXfCQpXCIsIFwiaVwiKTtcbmNvbnN0IFlFQVJfTlVNQkVSX0dST1VQID0gMTtcbmNvbnN0IE1PTlRIX05BTUVfR1JPVVAgPSAyO1xuY29uc3QgTU9OVEhfTlVNQkVSX0dST1VQID0gMztcbmNvbnN0IERBVEVfTlVNQkVSX0dST1VQID0gNDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOWWVhck1vbnRoRGF5UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIHN0cmljdE1vbnRoRGF0ZU9yZGVyO1xuICAgIGNvbnN0cnVjdG9yKHN0cmljdE1vbnRoRGF0ZU9yZGVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9udGhEYXRlT3JkZXIgPSBzdHJpY3RNb250aERhdGVPcmRlcjtcbiAgICB9XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZUludChtYXRjaFtZRUFSX05VTUJFUl9HUk9VUF0pO1xuICAgICAgICBsZXQgZGF5ID0gcGFyc2VJbnQobWF0Y2hbREFURV9OVU1CRVJfR1JPVVBdKTtcbiAgICAgICAgbGV0IG1vbnRoID0gbWF0Y2hbTU9OVEhfTlVNQkVSX0dST1VQXVxuICAgICAgICAgICAgPyBwYXJzZUludChtYXRjaFtNT05USF9OVU1CRVJfR1JPVVBdKVxuICAgICAgICAgICAgOiBNT05USF9ESUNUSU9OQVJZW21hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCldO1xuICAgICAgICBpZiAobW9udGggPCAxIHx8IG1vbnRoID4gMTIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0cmljdE1vbnRoRGF0ZU9yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF5ID49IDEgJiYgZGF5IDw9IDEyKSB7XG4gICAgICAgICAgICAgICAgW21vbnRoLCBkYXldID0gW2RheSwgbW9udGhdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkYXkgPCAxIHx8IGRheSA+IDMxKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZGF5OiBkYXksXG4gICAgICAgICAgICBtb250aDogbW9udGgsXG4gICAgICAgICAgICB5ZWFyOiB5ZWFyLFxuICAgICAgICB9O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOWWVhck1vbnRoRGF5UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoWzAtOV18MFsxLTldfDFbMDEyXSkvKFswLTldezR9KVwiICsgXCJcIiwgXCJpXCIpO1xuY29uc3QgTU9OVEhfR1JPVVAgPSAxO1xuY29uc3QgWUVBUl9HUk9VUCA9IDI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlNsYXNoTW9udGhGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZUludChtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gcGFyc2VJbnQobWF0Y2hbTU9OVEhfR1JPVVBdKTtcbiAgICAgICAgcmV0dXJuIGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoKS5pbXBseShcImRheVwiLCAxKS5hc3NpZ24oXCJtb250aFwiLCBtb250aCkuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTlNsYXNoTW9udGhGb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgTWVyaWRpZW0gfSBmcm9tIFwiLi4vLi4vdHlwZXMuanNcIjtcbmZ1bmN0aW9uIHByaW1hcnlUaW1lUGF0dGVybihsZWZ0Qm91bmRhcnksIHByaW1hcnlQcmVmaXgsIHByaW1hcnlTdWZmaXgsIGZsYWdzKSB7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoYCR7bGVmdEJvdW5kYXJ5fWAgK1xuICAgICAgICBgJHtwcmltYXJ5UHJlZml4fWAgK1xuICAgICAgICBgKFxcXFxkezEsNH0pYCArXG4gICAgICAgIGAoPzpgICtcbiAgICAgICAgYCg/OlxcXFwufDp877yaKWAgK1xuICAgICAgICBgKFxcXFxkezEsMn0pYCArXG4gICAgICAgIGAoPzpgICtcbiAgICAgICAgYCg/Ojp877yaKWAgK1xuICAgICAgICBgKFxcXFxkezJ9KWAgK1xuICAgICAgICBgKD86XFxcXC4oXFxcXGR7MSw2fSkpP2AgK1xuICAgICAgICBgKT9gICtcbiAgICAgICAgYCk/YCArXG4gICAgICAgIGAoPzpcXFxccyooYVxcXFwubVxcXFwufHBcXFxcLm1cXFxcLnxhbT98cG0/KSk/YCArXG4gICAgICAgIGAke3ByaW1hcnlTdWZmaXh9YCwgZmxhZ3MpO1xufVxuZnVuY3Rpb24gZm9sbG93aW5nVGltZVBhdHRlbihmb2xsb3dpbmdQaGFzZSwgZm9sbG93aW5nU3VmZml4KSB7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoYF4oJHtmb2xsb3dpbmdQaGFzZX0pYCArXG4gICAgICAgIGAoXFxcXGR7MSw0fSlgICtcbiAgICAgICAgYCg/OmAgK1xuICAgICAgICBgKD86XFxcXC58XFxcXDp8XFxcXO+8milgICtcbiAgICAgICAgYChcXFxcZHsxLDJ9KWAgK1xuICAgICAgICBgKD86YCArXG4gICAgICAgIGAoPzpcXFxcLnxcXFxcOnxcXFxc77yaKWAgK1xuICAgICAgICBgKFxcXFxkezEsMn0pKD86XFxcXC4oXFxcXGR7MSw2fSkpP2AgK1xuICAgICAgICBgKT9gICtcbiAgICAgICAgYCk/YCArXG4gICAgICAgIGAoPzpcXFxccyooYVxcXFwubVxcXFwufHBcXFxcLm1cXFxcLnxhbT98cG0/KSk/YCArXG4gICAgICAgIGAke2ZvbGxvd2luZ1N1ZmZpeH1gLCBcImlcIik7XG59XG5jb25zdCBIT1VSX0dST1VQID0gMjtcbmNvbnN0IE1JTlVURV9HUk9VUCA9IDM7XG5jb25zdCBTRUNPTkRfR1JPVVAgPSA0O1xuY29uc3QgTUlMTElfU0VDT05EX0dST1VQID0gNTtcbmNvbnN0IEFNX1BNX0hPVVJfR1JPVVAgPSA2O1xuZXhwb3J0IGNsYXNzIEFic3RyYWN0VGltZUV4cHJlc3Npb25QYXJzZXIge1xuICAgIHN0cmljdE1vZGU7XG4gICAgY29uc3RydWN0b3Ioc3RyaWN0TW9kZSA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIHBhdHRlcm5GbGFncygpIHtcbiAgICAgICAgcmV0dXJuIFwiaVwiO1xuICAgIH1cbiAgICBwcmltYXJ5UGF0dGVybkxlZnRCb3VuZGFyeSgpIHtcbiAgICAgICAgcmV0dXJuIGAoXnxcXFxcc3xUfFxcXFxiKWA7XG4gICAgfVxuICAgIHByaW1hcnlTdWZmaXgoKSB7XG4gICAgICAgIHJldHVybiBgKD8hLykoPz1cXFxcV3wkKWA7XG4gICAgfVxuICAgIGZvbGxvd2luZ1N1ZmZpeCgpIHtcbiAgICAgICAgcmV0dXJuIGAoPyEvKSg/PVxcXFxXfCQpYDtcbiAgICB9XG4gICAgcGF0dGVybihjb250ZXh0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlUaW1lUGF0dGVyblRocm91Z2hDYWNoZSgpO1xuICAgIH1cbiAgICBleHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0Q29tcG9uZW50cyA9IHRoaXMuZXh0cmFjdFByaW1hcnlUaW1lQ29tcG9uZW50cyhjb250ZXh0LCBtYXRjaCk7XG4gICAgICAgIGlmICghc3RhcnRDb21wb25lbnRzKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2hbMF0ubWF0Y2goL15cXGR7NH0vKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoLmluZGV4ICs9IDQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtYXRjaC5pbmRleCArPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMV0ubGVuZ3RoO1xuICAgICAgICBjb25zdCB0ZXh0ID0gbWF0Y2hbMF0uc3Vic3RyaW5nKG1hdGNoWzFdLmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChpbmRleCwgdGV4dCwgc3RhcnRDb21wb25lbnRzKTtcbiAgICAgICAgbWF0Y2guaW5kZXggKz0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICBjb25zdCByZW1haW5pbmdUZXh0ID0gY29udGV4dC50ZXh0LnN1YnN0cmluZyhtYXRjaC5pbmRleCk7XG4gICAgICAgIGNvbnN0IGZvbGxvd2luZ1BhdHRlcm4gPSB0aGlzLmdldEZvbGxvd2luZ1RpbWVQYXR0ZXJuVGhyb3VnaENhY2hlKCk7XG4gICAgICAgIGNvbnN0IGZvbGxvd2luZ01hdGNoID0gZm9sbG93aW5nUGF0dGVybi5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgICAgICBpZiAodGV4dC5tYXRjaCgvXlxcZHszLDR9LykgJiYgZm9sbG93aW5nTWF0Y2gpIHtcbiAgICAgICAgICAgIGlmIChmb2xsb3dpbmdNYXRjaFswXS5tYXRjaCgvXlxccyooWystXSlcXHMqXFxkezIsNH0kLykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb2xsb3dpbmdNYXRjaFswXS5tYXRjaCgvXlxccyooWystXSlcXHMqXFxkezJ9XFxXXFxkezJ9LykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWZvbGxvd2luZ01hdGNoIHx8XG4gICAgICAgICAgICBmb2xsb3dpbmdNYXRjaFswXS5tYXRjaCgvXlxccyooWystXSlcXHMqXFxkezMsNH0kLykpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNoZWNrQW5kUmV0dXJuV2l0aG91dEZvbGxvd2luZ1BhdHRlcm4ocmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuZW5kID0gdGhpcy5leHRyYWN0Rm9sbG93aW5nVGltZUNvbXBvbmVudHMoY29udGV4dCwgZm9sbG93aW5nTWF0Y2gsIHJlc3VsdCk7XG4gICAgICAgIGlmIChyZXN1bHQuZW5kKSB7XG4gICAgICAgICAgICByZXN1bHQudGV4dCArPSBmb2xsb3dpbmdNYXRjaFswXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5jaGVja0FuZFJldHVybldpdGhGb2xsb3dpbmdQYXR0ZXJuKHJlc3VsdCk7XG4gICAgfVxuICAgIGV4dHJhY3RQcmltYXJ5VGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gsIHN0cmljdCA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKCk7XG4gICAgICAgIGxldCBtaW51dGUgPSAwO1xuICAgICAgICBsZXQgbWVyaWRpZW0gPSBudWxsO1xuICAgICAgICBsZXQgaG91ciA9IHBhcnNlSW50KG1hdGNoW0hPVVJfR1JPVVBdKTtcbiAgICAgICAgaWYgKGhvdXIgPiAxMDApIHtcbiAgICAgICAgICAgIGlmIChtYXRjaFtIT1VSX0dST1VQXS5sZW5ndGggPT0gNCAmJiBtYXRjaFtNSU5VVEVfR1JPVVBdID09IG51bGwgJiYgIW1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zdHJpY3RNb2RlIHx8IG1hdGNoW01JTlVURV9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWludXRlID0gaG91ciAlIDEwMDtcbiAgICAgICAgICAgIGhvdXIgPSBNYXRoLmZsb29yKGhvdXIgLyAxMDApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID4gMjQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdLmxlbmd0aCA9PSAxICYmICFtYXRjaFtBTV9QTV9IT1VSX0dST1VQXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWludXRlID0gcGFyc2VJbnQobWF0Y2hbTUlOVVRFX0dST1VQXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1pbnV0ZSA+PSA2MCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhvdXIgPiAxMikge1xuICAgICAgICAgICAgbWVyaWRpZW0gPSBNZXJpZGllbS5QTTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbQU1fUE1fSE9VUl9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGhvdXIgPiAxMilcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGFtcG0gPSBtYXRjaFtBTV9QTV9IT1VSX0dST1VQXVswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJhXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IE1lcmlkaWVtLkFNO1xuICAgICAgICAgICAgICAgIGlmIChob3VyID09IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhbXBtID09IFwicFwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSBNZXJpZGllbS5QTTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMikge1xuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImhvdXJcIiwgaG91cik7XG4gICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWludXRlXCIsIG1pbnV0ZSk7XG4gICAgICAgIGlmIChtZXJpZGllbSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtZXJpZGllbVwiLCBtZXJpZGllbSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoaG91ciA8IDEyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW01JTExJX1NFQ09ORF9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgbWlsbGlzZWNvbmQgPSBwYXJzZUludChtYXRjaFtNSUxMSV9TRUNPTkRfR1JPVVBdLnN1YnN0cmluZygwLCAzKSk7XG4gICAgICAgICAgICBpZiAobWlsbGlzZWNvbmQgPj0gMTAwMClcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWlsbGlzZWNvbmRcIiwgbWlsbGlzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtTRUNPTkRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9IHBhcnNlSW50KG1hdGNoW1NFQ09ORF9HUk9VUF0pO1xuICAgICAgICAgICAgaWYgKHNlY29uZCA+PSA2MClcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwic2Vjb25kXCIsIHNlY29uZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgfVxuICAgIGV4dHJhY3RGb2xsb3dpbmdUaW1lQ29tcG9uZW50cyhjb250ZXh0LCBtYXRjaCwgcmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKCk7XG4gICAgICAgIGlmIChtYXRjaFtNSUxMSV9TRUNPTkRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG1pbGxpc2Vjb25kID0gcGFyc2VJbnQobWF0Y2hbTUlMTElfU0VDT05EX0dST1VQXS5zdWJzdHJpbmcoMCwgMykpO1xuICAgICAgICAgICAgaWYgKG1pbGxpc2Vjb25kID49IDEwMDApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1pbGxpc2Vjb25kXCIsIG1pbGxpc2Vjb25kKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbU0VDT05EX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBzZWNvbmQgPSBwYXJzZUludChtYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChzZWNvbmQgPj0gNjApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInNlY29uZFwiLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBob3VyID0gcGFyc2VJbnQobWF0Y2hbSE9VUl9HUk9VUF0pO1xuICAgICAgICBsZXQgbWludXRlID0gMDtcbiAgICAgICAgbGV0IG1lcmlkaWVtID0gLTE7XG4gICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIG1pbnV0ZSA9IHBhcnNlSW50KG1hdGNoW01JTlVURV9HUk9VUF0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGhvdXIgPiAxMDApIHtcbiAgICAgICAgICAgIG1pbnV0ZSA9IGhvdXIgJSAxMDA7XG4gICAgICAgICAgICBob3VyID0gTWF0aC5mbG9vcihob3VyIC8gMTAwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWludXRlID49IDYwIHx8IGhvdXIgPiAyNCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhvdXIgPj0gMTIpIHtcbiAgICAgICAgICAgIG1lcmlkaWVtID0gTWVyaWRpZW0uUE07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChob3VyID4gMTIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFtcG0gPSBtYXRjaFtBTV9QTV9IT1VSX0dST1VQXVswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJhXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IE1lcmlkaWVtLkFNO1xuICAgICAgICAgICAgICAgIGlmIChob3VyID09IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudHMuaXNDZXJ0YWluKFwiZGF5XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGNvbXBvbmVudHMuZ2V0KFwiZGF5XCIpICsgMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYW1wbSA9PSBcInBcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gTWVyaWRpZW0uUE07XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSkge1xuICAgICAgICAgICAgICAgIGlmIChtZXJpZGllbSA9PSBNZXJpZGllbS5BTSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSA9PSAxMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImhvdXJcIiwgMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5nZXQoXCJob3VyXCIpICE9IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImhvdXJcIiwgaG91cik7XG4gICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWludXRlXCIsIG1pbnV0ZSk7XG4gICAgICAgIGlmIChtZXJpZGllbSA+PSAwKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIG1lcmlkaWVtKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0QXRQTSA9IHJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSAmJiByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSA+IDEyO1xuICAgICAgICAgICAgaWYgKHN0YXJ0QXRQTSkge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSAtIDEyID4gaG91cikge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uQU0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChob3VyIDw9IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiaG91clwiLCBob3VyICsgMTIpO1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChob3VyID4gMTIpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaG91ciA8PSAxMikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbXBvbmVudHMuZGF0ZSgpLmdldFRpbWUoKSA8IHJlc3VsdC5zdGFydC5kYXRlKCkuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGNvbXBvbmVudHMuZ2V0KFwiZGF5XCIpICsgMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgfVxuICAgIGNoZWNrQW5kUmV0dXJuV2l0aG91dEZvbGxvd2luZ1BhdHRlcm4ocmVzdWx0KSB7XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5tYXRjaCgvXlxcZCQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC50ZXh0Lm1hdGNoKC9eXFxkXFxkXFxkKyQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC50ZXh0Lm1hdGNoKC9cXGRbYXBBUF0kLykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVuZGluZ1dpdGhOdW1iZXJzID0gcmVzdWx0LnRleHQubWF0Y2goL1teXFxkOi5dKFxcZFtcXGQuXSspJC8pO1xuICAgICAgICBpZiAoZW5kaW5nV2l0aE51bWJlcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGVuZGluZ051bWJlcnMgPSBlbmRpbmdXaXRoTnVtYmVyc1sxXTtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0cmljdE1vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlbmRpbmdOdW1iZXJzLmluY2x1ZGVzKFwiLlwiKSAmJiAhZW5kaW5nTnVtYmVycy5tYXRjaCgvXFxkKFxcLlxcZHsyfSkrJC8pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBlbmRpbmdOdW1iZXJWYWwgPSBwYXJzZUludChlbmRpbmdOdW1iZXJzKTtcbiAgICAgICAgICAgIGlmIChlbmRpbmdOdW1iZXJWYWwgPiAyNCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGNoZWNrQW5kUmV0dXJuV2l0aEZvbGxvd2luZ1BhdHRlcm4ocmVzdWx0KSB7XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5tYXRjaCgvXlxcZCstXFxkKyQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZW5kaW5nV2l0aE51bWJlcnMgPSByZXN1bHQudGV4dC5tYXRjaCgvW15cXGQ6Ll0oXFxkW1xcZC5dKylcXHMqLVxccyooXFxkW1xcZC5dKykkLyk7XG4gICAgICAgIGlmIChlbmRpbmdXaXRoTnVtYmVycykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3RyaWN0TW9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3RhcnRpbmdOdW1iZXJzID0gZW5kaW5nV2l0aE51bWJlcnNbMV07XG4gICAgICAgICAgICBjb25zdCBlbmRpbmdOdW1iZXJzID0gZW5kaW5nV2l0aE51bWJlcnNbMl07XG4gICAgICAgICAgICBpZiAoZW5kaW5nTnVtYmVycy5pbmNsdWRlcyhcIi5cIikgJiYgIWVuZGluZ051bWJlcnMubWF0Y2goL1xcZChcXC5cXGR7Mn0pKyQvKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZW5kaW5nTnVtYmVyVmFsID0gcGFyc2VJbnQoZW5kaW5nTnVtYmVycyk7XG4gICAgICAgICAgICBjb25zdCBzdGFydGluZ051bWJlclZhbCA9IHBhcnNlSW50KHN0YXJ0aW5nTnVtYmVycyk7XG4gICAgICAgICAgICBpZiAoZW5kaW5nTnVtYmVyVmFsID4gMjQgfHwgc3RhcnRpbmdOdW1iZXJWYWwgPiAyNCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGNhY2hlZFByaW1hcnlQcmVmaXggPSBudWxsO1xuICAgIGNhY2hlZFByaW1hcnlTdWZmaXggPSBudWxsO1xuICAgIGNhY2hlZFByaW1hcnlUaW1lUGF0dGVybiA9IG51bGw7XG4gICAgZ2V0UHJpbWFyeVRpbWVQYXR0ZXJuVGhyb3VnaENhY2hlKCkge1xuICAgICAgICBjb25zdCBwcmltYXJ5UHJlZml4ID0gdGhpcy5wcmltYXJ5UHJlZml4KCk7XG4gICAgICAgIGNvbnN0IHByaW1hcnlTdWZmaXggPSB0aGlzLnByaW1hcnlTdWZmaXgoKTtcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVkUHJpbWFyeVByZWZpeCA9PT0gcHJpbWFyeVByZWZpeCAmJiB0aGlzLmNhY2hlZFByaW1hcnlTdWZmaXggPT09IHByaW1hcnlTdWZmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFByaW1hcnlUaW1lUGF0dGVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNhY2hlZFByaW1hcnlUaW1lUGF0dGVybiA9IHByaW1hcnlUaW1lUGF0dGVybih0aGlzLnByaW1hcnlQYXR0ZXJuTGVmdEJvdW5kYXJ5KCksIHByaW1hcnlQcmVmaXgsIHByaW1hcnlTdWZmaXgsIHRoaXMucGF0dGVybkZsYWdzKCkpO1xuICAgICAgICB0aGlzLmNhY2hlZFByaW1hcnlQcmVmaXggPSBwcmltYXJ5UHJlZml4O1xuICAgICAgICB0aGlzLmNhY2hlZFByaW1hcnlTdWZmaXggPSBwcmltYXJ5U3VmZml4O1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZWRQcmltYXJ5VGltZVBhdHRlcm47XG4gICAgfVxuICAgIGNhY2hlZEZvbGxvd2luZ1BoYXNlID0gbnVsbDtcbiAgICBjYWNoZWRGb2xsb3dpbmdTdWZmaXggPSBudWxsO1xuICAgIGNhY2hlZEZvbGxvd2luZ1RpbWVQYXR0ZW4gPSBudWxsO1xuICAgIGdldEZvbGxvd2luZ1RpbWVQYXR0ZXJuVGhyb3VnaENhY2hlKCkge1xuICAgICAgICBjb25zdCBmb2xsb3dpbmdQaGFzZSA9IHRoaXMuZm9sbG93aW5nUGhhc2UoKTtcbiAgICAgICAgY29uc3QgZm9sbG93aW5nU3VmZml4ID0gdGhpcy5mb2xsb3dpbmdTdWZmaXgoKTtcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVkRm9sbG93aW5nUGhhc2UgPT09IGZvbGxvd2luZ1BoYXNlICYmIHRoaXMuY2FjaGVkRm9sbG93aW5nU3VmZml4ID09PSBmb2xsb3dpbmdTdWZmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlZEZvbGxvd2luZ1RpbWVQYXR0ZW47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jYWNoZWRGb2xsb3dpbmdUaW1lUGF0dGVuID0gZm9sbG93aW5nVGltZVBhdHRlbihmb2xsb3dpbmdQaGFzZSwgZm9sbG93aW5nU3VmZml4KTtcbiAgICAgICAgdGhpcy5jYWNoZWRGb2xsb3dpbmdQaGFzZSA9IGZvbGxvd2luZ1BoYXNlO1xuICAgICAgICB0aGlzLmNhY2hlZEZvbGxvd2luZ1N1ZmZpeCA9IGZvbGxvd2luZ1N1ZmZpeDtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FjaGVkRm9sbG93aW5nVGltZVBhdHRlbjtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1BYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IE1lcmlkaWVtIH0gZnJvbSBcIi4uLy4uLy4uL3R5cGVzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0VGltZUV4cHJlc3Npb25QYXJzZXIuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZUV4cHJlc3Npb25QYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyIHtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKHN0cmljdE1vZGUpO1xuICAgIH1cbiAgICBmb2xsb3dpbmdQaGFzZSgpIHtcbiAgICAgICAgcmV0dXJuIFwiXFxcXHMqKD86XFxcXC18XFxcXOKAk3xcXFxcfnxcXFxc44CcfHRvfHVudGlsfHRocm91Z2h8dGlsbHxcXFxcPylcXFxccypcIjtcbiAgICB9XG4gICAgcHJpbWFyeVByZWZpeCgpIHtcbiAgICAgICAgcmV0dXJuIFwiKD86KD86YXR8ZnJvbSlcXFxccyopPz9cIjtcbiAgICB9XG4gICAgcHJpbWFyeVN1ZmZpeCgpIHtcbiAgICAgICAgcmV0dXJuIFwiKD86XFxcXHMqKD86b1xcXFxXKmNsb2NrfGF0XFxcXHMqbmlnaHR8aW5cXFxccyp0aGVcXFxccyooPzptb3JuaW5nfGFmdGVybm9vbikpKT8oPyEvKSg/PVxcXFxXfCQpXCI7XG4gICAgfVxuICAgIGV4dHJhY3RQcmltYXJ5VGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IHN1cGVyLmV4dHJhY3RQcmltYXJ5VGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gpO1xuICAgICAgICBpZiAoIWNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnRzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFswXS5lbmRzV2l0aChcIm5pZ2h0XCIpKSB7XG4gICAgICAgICAgICBjb25zdCBob3VyID0gY29tcG9uZW50cy5nZXQoXCJob3VyXCIpO1xuICAgICAgICAgICAgaWYgKGhvdXIgPj0gNiAmJiBob3VyIDwgMTIpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImhvdXJcIiwgY29tcG9uZW50cy5nZXQoXCJob3VyXCIpICsgMTIpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaG91ciA8IDYpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbMF0uZW5kc1dpdGgoXCJhZnRlcm5vb25cIikpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgICAgICAgICAgY29uc3QgaG91ciA9IGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKTtcbiAgICAgICAgICAgIGlmIChob3VyID49IDAgJiYgaG91ciA8PSA2KSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbMF0uZW5kc1dpdGgoXCJtb3JuaW5nXCIpKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICAgICAgICAgIGNvbnN0IGhvdXIgPSBjb21wb25lbnRzLmdldChcImhvdXJcIik7XG4gICAgICAgICAgICBpZiAoaG91ciA8IDEyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHMuYWRkVGFnKFwicGFyc2VyL0VOVGltZUV4cHJlc3Npb25QYXJzZXJcIik7XG4gICAgfVxuICAgIGV4dHJhY3RGb2xsb3dpbmdUaW1lQ29tcG9uZW50cyhjb250ZXh0LCBtYXRjaCwgcmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IGZvbGxvd2luZ0NvbXBvbmVudHMgPSBzdXBlci5leHRyYWN0Rm9sbG93aW5nVGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gsIHJlc3VsdCk7XG4gICAgICAgIGlmIChmb2xsb3dpbmdDb21wb25lbnRzKSB7XG4gICAgICAgICAgICBmb2xsb3dpbmdDb21wb25lbnRzLmFkZFRhZyhcInBhcnNlci9FTlRpbWVFeHByZXNzaW9uUGFyc2VyXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmb2xsb3dpbmdDb21wb25lbnRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZUV4cHJlc3Npb25QYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgcGFyc2VEdXJhdGlvbiwgVElNRV9VTklUU19OT19BQkJSX1BBVFRFUk4sIFRJTUVfVU5JVFNfUEFUVEVSTiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuaW1wb3J0IHsgcmV2ZXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKCR7VElNRV9VTklUU19QQVRURVJOfSlcXFxcc3swLDV9KD86YWdvfGJlZm9yZXxlYXJsaWVyKSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgU1RSSUNUX1BBVFRFUk4gPSBuZXcgUmVnRXhwKGAoJHtUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTn0pXFxcXHN7MCw1fSg/OmFnb3xiZWZvcmV8ZWFybGllcikoPz1cXFxcV3wkKWAsIFwiaVwiKTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgc3RyaWN0TW9kZTtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaWN0TW9kZSA/IFNUUklDVF9QQVRURVJOIDogUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0gcGFyc2VEdXJhdGlvbihtYXRjaFsxXSk7XG4gICAgICAgIGlmICghZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHJldmVyc2VEdXJhdGlvbihkdXJhdGlvbikpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgcGFyc2VEdXJhdGlvbiwgVElNRV9VTklUU19OT19BQkJSX1BBVFRFUk4sIFRJTUVfVU5JVFNfUEFUVEVSTiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCgke1RJTUVfVU5JVFNfUEFUVEVSTn0pXFxcXHN7MCw1fSg/OmxhdGVyfGFmdGVyfGZyb20gbm93fGhlbmNlZm9ydGh8Zm9yd2FyZHxvdXQpYCArIFwiKD89KD86XFxcXFd8JCkpXCIsIFwiaVwiKTtcbmNvbnN0IFNUUklDVF9QQVRURVJOID0gbmV3IFJlZ0V4cChgKCR7VElNRV9VTklUU19OT19BQkJSX1BBVFRFUk59KVxcXFxzezAsNX0obGF0ZXJ8YWZ0ZXJ8ZnJvbSBub3cpKD89XFxcXFd8JClgLCBcImlcIik7XG5jb25zdCBHUk9VUF9OVU1fVElNRVVOSVRTID0gMTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZVVuaXRMYXRlckZvcm1hdFBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBzdHJpY3RNb2RlO1xuICAgIGNvbnN0cnVjdG9yKHN0cmljdE1vZGUpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5zdHJpY3RNb2RlID0gc3RyaWN0TW9kZTtcbiAgICB9XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJpY3RNb2RlID8gU1RSSUNUX1BBVFRFUk4gOiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgdGltZVVuaXRzID0gcGFyc2VEdXJhdGlvbihtYXRjaFtHUk9VUF9OVU1fVElNRVVOSVRTXSk7XG4gICAgICAgIGlmICghdGltZVVuaXRzKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCB0aW1lVW5pdHMpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZVVuaXRMYXRlckZvcm1hdFBhcnNlci5qcy5tYXAiLCJleHBvcnQgY2xhc3MgRmlsdGVyIHtcbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICByZXR1cm4gcmVzdWx0cy5maWx0ZXIoKHIpID0+IHRoaXMuaXNWYWxpZChjb250ZXh0LCByKSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtZXJnZWRSZXN1bHRzID0gW107XG4gICAgICAgIGxldCBjdXJSZXN1bHQgPSByZXN1bHRzWzBdO1xuICAgICAgICBsZXQgbmV4dFJlc3VsdCA9IG51bGw7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbmV4dFJlc3VsdCA9IHJlc3VsdHNbaV07XG4gICAgICAgICAgICBjb25zdCB0ZXh0QmV0d2VlbiA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcoY3VyUmVzdWx0LmluZGV4ICsgY3VyUmVzdWx0LnRleHQubGVuZ3RoLCBuZXh0UmVzdWx0LmluZGV4KTtcbiAgICAgICAgICAgIGlmICghdGhpcy5zaG91bGRNZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1clJlc3VsdCwgbmV4dFJlc3VsdCwgY29udGV4dCkpIHtcbiAgICAgICAgICAgICAgICBtZXJnZWRSZXN1bHRzLnB1c2goY3VyUmVzdWx0KTtcbiAgICAgICAgICAgICAgICBjdXJSZXN1bHQgPSBuZXh0UmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVmdCA9IGN1clJlc3VsdDtcbiAgICAgICAgICAgICAgICBjb25zdCByaWdodCA9IG5leHRSZXN1bHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVyZ2VkUmVzdWx0ID0gdGhpcy5tZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGxlZnQsIHJpZ2h0LCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBtZXJnZWQgJHtsZWZ0fSBhbmQgJHtyaWdodH0gaW50byAke21lcmdlZFJlc3VsdH1gKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjdXJSZXN1bHQgPSBtZXJnZWRSZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1clJlc3VsdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBtZXJnZWRSZXN1bHRzLnB1c2goY3VyUmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVyZ2VkUmVzdWx0cztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1hYnN0cmFjdFJlZmluZXJzLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uL2Fic3RyYWN0UmVmaW5lcnMuanNcIjtcbmltcG9ydCB7IGFkZER1cmF0aW9uIH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciBleHRlbmRzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICBzaG91bGRNZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuICFjdXJyZW50UmVzdWx0LmVuZCAmJiAhbmV4dFJlc3VsdC5lbmQgJiYgdGV4dEJldHdlZW4ubWF0Y2godGhpcy5wYXR0ZXJuQmV0d2VlbigpKSAhPSBudWxsO1xuICAgIH1cbiAgICBtZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGZyb21SZXN1bHQsIHRvUmVzdWx0KSB7XG4gICAgICAgIGlmICghZnJvbVJlc3VsdC5zdGFydC5pc09ubHlXZWVrZGF5Q29tcG9uZW50KCkgJiYgIXRvUmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSkge1xuICAgICAgICAgICAgdG9SZXN1bHQuc3RhcnQuZ2V0Q2VydGFpbkNvbXBvbmVudHMoKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWZyb21SZXN1bHQuc3RhcnQuaXNDZXJ0YWluKGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbVJlc3VsdC5zdGFydC5pbXBseShrZXksIHRvUmVzdWx0LnN0YXJ0LmdldChrZXkpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGZyb21SZXN1bHQuc3RhcnQuZ2V0Q2VydGFpbkNvbXBvbmVudHMoKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRvUmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KGtleSwgZnJvbVJlc3VsdC5zdGFydC5nZXQoa2V5KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZyb21SZXN1bHQuc3RhcnQuZGF0ZSgpID4gdG9SZXN1bHQuc3RhcnQuZGF0ZSgpKSB7XG4gICAgICAgICAgICBsZXQgZnJvbURhdGUgPSBmcm9tUmVzdWx0LnN0YXJ0LmRhdGUoKTtcbiAgICAgICAgICAgIGxldCB0b0RhdGUgPSB0b1Jlc3VsdC5zdGFydC5kYXRlKCk7XG4gICAgICAgICAgICBpZiAodG9SZXN1bHQuc3RhcnQuaXNPbmx5V2Vla2RheUNvbXBvbmVudCgpICYmIGFkZER1cmF0aW9uKHRvRGF0ZSwgeyBkYXk6IDcgfSkgPiBmcm9tRGF0ZSkge1xuICAgICAgICAgICAgICAgIHRvRGF0ZSA9IGFkZER1cmF0aW9uKHRvRGF0ZSwgeyBkYXk6IDcgfSk7XG4gICAgICAgICAgICAgICAgdG9SZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgdG9EYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICAgICAgdG9SZXN1bHQuc3RhcnQuaW1wbHkoXCJtb250aFwiLCB0b0RhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCB0b0RhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChmcm9tUmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSAmJiBhZGREdXJhdGlvbihmcm9tRGF0ZSwgeyBkYXk6IC03IH0pIDwgdG9EYXRlKSB7XG4gICAgICAgICAgICAgICAgZnJvbURhdGUgPSBhZGREdXJhdGlvbihmcm9tRGF0ZSwgeyBkYXk6IC03IH0pO1xuICAgICAgICAgICAgICAgIGZyb21SZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgZnJvbURhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgICAgICBmcm9tUmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgZnJvbURhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgIGZyb21SZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIGZyb21EYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodG9SZXN1bHQuc3RhcnQuaXNEYXRlV2l0aFVua25vd25ZZWFyKCkgJiYgYWRkRHVyYXRpb24odG9EYXRlLCB7IHllYXI6IDEgfSkgPiBmcm9tRGF0ZSkge1xuICAgICAgICAgICAgICAgIHRvRGF0ZSA9IGFkZER1cmF0aW9uKHRvRGF0ZSwgeyB5ZWFyOiAxIH0pO1xuICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCB0b0RhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChmcm9tUmVzdWx0LnN0YXJ0LmlzRGF0ZVdpdGhVbmtub3duWWVhcigpICYmIGFkZER1cmF0aW9uKGZyb21EYXRlLCB7IHllYXI6IC0xIH0pIDwgdG9EYXRlKSB7XG4gICAgICAgICAgICAgICAgZnJvbURhdGUgPSBhZGREdXJhdGlvbihmcm9tRGF0ZSwgeyB5ZWFyOiAtMSB9KTtcbiAgICAgICAgICAgICAgICBmcm9tUmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCBmcm9tRGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIFt0b1Jlc3VsdCwgZnJvbVJlc3VsdF0gPSBbZnJvbVJlc3VsdCwgdG9SZXN1bHRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGZyb21SZXN1bHQuY2xvbmUoKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0ID0gZnJvbVJlc3VsdC5zdGFydDtcbiAgICAgICAgcmVzdWx0LmVuZCA9IHRvUmVzdWx0LnN0YXJ0O1xuICAgICAgICByZXN1bHQuaW5kZXggPSBNYXRoLm1pbihmcm9tUmVzdWx0LmluZGV4LCB0b1Jlc3VsdC5pbmRleCk7XG4gICAgICAgIGlmIChmcm9tUmVzdWx0LmluZGV4IDwgdG9SZXN1bHQuaW5kZXgpIHtcbiAgICAgICAgICAgIHJlc3VsdC50ZXh0ID0gZnJvbVJlc3VsdC50ZXh0ICsgdGV4dEJldHdlZW4gKyB0b1Jlc3VsdC50ZXh0O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LnRleHQgPSB0b1Jlc3VsdC50ZXh0ICsgdGV4dEJldHdlZW4gKyBmcm9tUmVzdWx0LnRleHQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1BYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgQWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIgZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5NZXJnZURhdGVSYW5nZVJlZmluZXIgZXh0ZW5kcyBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciB7XG4gICAgcGF0dGVybkJldHdlZW4oKSB7XG4gICAgICAgIHJldHVybiAvXlxccyoodG98LXzigJN8dW50aWx8dGhyb3VnaHx0aWxsKVxccyokL2k7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5NZXJnZURhdGVSYW5nZVJlZmluZXIuanMubWFwIiwiaW1wb3J0IHsgTWVyaWRpZW0gfSBmcm9tIFwiLi4vdHlwZXMuanNcIjtcbmltcG9ydCB7IGFzc2lnblNpbWlsYXJEYXRlLCBpbXBseVNpbWlsYXJEYXRlIH0gZnJvbSBcIi4uL3V0aWxzL2RhdGVzLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VEYXRlVGltZVJlc3VsdChkYXRlUmVzdWx0LCB0aW1lUmVzdWx0KSB7XG4gICAgY29uc3QgcmVzdWx0ID0gZGF0ZVJlc3VsdC5jbG9uZSgpO1xuICAgIGNvbnN0IGJlZ2luRGF0ZSA9IGRhdGVSZXN1bHQuc3RhcnQ7XG4gICAgY29uc3QgYmVnaW5UaW1lID0gdGltZVJlc3VsdC5zdGFydDtcbiAgICByZXN1bHQuc3RhcnQgPSBtZXJnZURhdGVUaW1lQ29tcG9uZW50KGJlZ2luRGF0ZSwgYmVnaW5UaW1lKTtcbiAgICBpZiAoZGF0ZVJlc3VsdC5lbmQgIT0gbnVsbCB8fCB0aW1lUmVzdWx0LmVuZCAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVuZERhdGUgPSBkYXRlUmVzdWx0LmVuZCA9PSBudWxsID8gZGF0ZVJlc3VsdC5zdGFydCA6IGRhdGVSZXN1bHQuZW5kO1xuICAgICAgICBjb25zdCBlbmRUaW1lID0gdGltZVJlc3VsdC5lbmQgPT0gbnVsbCA/IHRpbWVSZXN1bHQuc3RhcnQgOiB0aW1lUmVzdWx0LmVuZDtcbiAgICAgICAgY29uc3QgZW5kRGF0ZVRpbWUgPSBtZXJnZURhdGVUaW1lQ29tcG9uZW50KGVuZERhdGUsIGVuZFRpbWUpO1xuICAgICAgICBpZiAoZGF0ZVJlc3VsdC5lbmQgPT0gbnVsbCAmJiBlbmREYXRlVGltZS5kYXRlKCkuZ2V0VGltZSgpIDwgcmVzdWx0LnN0YXJ0LmRhdGUoKS5nZXRUaW1lKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5leHREYXkgPSBuZXcgRGF0ZShlbmREYXRlVGltZS5kYXRlKCkuZ2V0VGltZSgpKTtcbiAgICAgICAgICAgIG5leHREYXkuc2V0RGF0ZShuZXh0RGF5LmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgaWYgKGVuZERhdGVUaW1lLmlzQ2VydGFpbihcImRheVwiKSkge1xuICAgICAgICAgICAgICAgIGFzc2lnblNpbWlsYXJEYXRlKGVuZERhdGVUaW1lLCBuZXh0RGF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGltcGx5U2ltaWxhckRhdGUoZW5kRGF0ZVRpbWUsIG5leHREYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5lbmQgPSBlbmREYXRlVGltZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZURhdGVUaW1lQ29tcG9uZW50KGRhdGVDb21wb25lbnQsIHRpbWVDb21wb25lbnQpIHtcbiAgICBjb25zdCBkYXRlVGltZUNvbXBvbmVudCA9IGRhdGVDb21wb25lbnQuY2xvbmUoKTtcbiAgICBpZiAodGltZUNvbXBvbmVudC5pc0NlcnRhaW4oXCJob3VyXCIpKSB7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcImhvdXJcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJob3VyXCIpKTtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuYXNzaWduKFwibWludXRlXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWludXRlXCIpKTtcbiAgICAgICAgaWYgKHRpbWVDb21wb25lbnQuaXNDZXJ0YWluKFwic2Vjb25kXCIpKSB7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5hc3NpZ24oXCJzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJzZWNvbmRcIikpO1xuICAgICAgICAgICAgaWYgKHRpbWVDb21wb25lbnQuaXNDZXJ0YWluKFwibWlsbGlzZWNvbmRcIikpIHtcbiAgICAgICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5hc3NpZ24oXCJtaWxsaXNlY29uZFwiLCB0aW1lQ29tcG9uZW50LmdldChcIm1pbGxpc2Vjb25kXCIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtaWxsaXNlY29uZFwiKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcInNlY29uZFwiLCB0aW1lQ29tcG9uZW50LmdldChcInNlY29uZFwiKSk7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWlsbGlzZWNvbmRcIikpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJob3VyXCIpKTtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtaW51dGVcIikpO1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcInNlY29uZFwiLCB0aW1lQ29tcG9uZW50LmdldChcInNlY29uZFwiKSk7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtaWxsaXNlY29uZFwiKSk7XG4gICAgfVxuICAgIGlmICh0aW1lQ29tcG9uZW50LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIHRpbWVDb21wb25lbnQuZ2V0KFwidGltZXpvbmVPZmZzZXRcIikpO1xuICAgIH1cbiAgICBjb25zdCBkYXRlSGFzTWVhbmluZ2Z1bE1lcmlkaWVtID0gZGF0ZUNvbXBvbmVudC5nZXQoXCJtZXJpZGllbVwiKSAhPSBudWxsICYmXG4gICAgICAgIChkYXRlQ29tcG9uZW50LmlzQ2VydGFpbihcIm1lcmlkaWVtXCIpIHx8XG4gICAgICAgICAgICBBcnJheS5mcm9tKGRhdGVDb21wb25lbnQudGFncygpKS5zb21lKCh0KSA9PiB0LnN0YXJ0c1dpdGgoXCJjYXN1YWxSZWZlcmVuY2UvXCIpKSk7XG4gICAgaWYgKHRpbWVDb21wb25lbnQuaXNDZXJ0YWluKFwibWVyaWRpZW1cIikpIHtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuYXNzaWduKFwibWVyaWRpZW1cIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtZXJpZGllbVwiKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRpbWVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikgIT0gbnVsbCAmJiAhZGF0ZUhhc01lYW5pbmdmdWxNZXJpZGllbSkge1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcIm1lcmlkaWVtXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikpO1xuICAgIH1cbiAgICBpZiAoZGF0ZVRpbWVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikgPT0gTWVyaWRpZW0uUE0gJiYgZGF0ZVRpbWVDb21wb25lbnQuZ2V0KFwiaG91clwiKSA8IDEyKSB7XG4gICAgICAgIGlmICh0aW1lQ29tcG9uZW50LmlzQ2VydGFpbihcImhvdXJcIikpIHtcbiAgICAgICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcImhvdXJcIiwgZGF0ZVRpbWVDb21wb25lbnQuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmltcGx5KFwiaG91clwiLCBkYXRlVGltZUNvbXBvbmVudC5nZXQoXCJob3VyXCIpICsgMTIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGRhdGVUaW1lQ29tcG9uZW50LmFkZFRhZ3MoZGF0ZUNvbXBvbmVudC50YWdzKCkpO1xuICAgIGRhdGVUaW1lQ29tcG9uZW50LmFkZFRhZ3ModGltZUNvbXBvbmVudC50YWdzKCkpO1xuICAgIHJldHVybiBkYXRlVGltZUNvbXBvbmVudDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW1lcmdpbmdDYWxjdWxhdGlvbi5qcy5tYXAiLCJpbXBvcnQgeyBNZXJnaW5nUmVmaW5lciB9IGZyb20gXCIuLi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5pbXBvcnQgeyBtZXJnZURhdGVUaW1lUmVzdWx0IH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL21lcmdpbmdDYWxjdWxhdGlvbi5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lciBleHRlbmRzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICBzaG91bGRNZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuICgoKGN1cnJlbnRSZXN1bHQuc3RhcnQuaXNPbmx5RGF0ZSgpICYmIG5leHRSZXN1bHQuc3RhcnQuaXNPbmx5VGltZSgpKSB8fFxuICAgICAgICAgICAgKG5leHRSZXN1bHQuc3RhcnQuaXNPbmx5RGF0ZSgpICYmIGN1cnJlbnRSZXN1bHQuc3RhcnQuaXNPbmx5VGltZSgpKSkgJiZcbiAgICAgICAgICAgIHRleHRCZXR3ZWVuLm1hdGNoKHRoaXMucGF0dGVybkJldHdlZW4oKSkgIT0gbnVsbCk7XG4gICAgfVxuICAgIG1lcmdlUmVzdWx0cyh0ZXh0QmV0d2VlbiwgY3VycmVudFJlc3VsdCwgbmV4dFJlc3VsdCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjdXJyZW50UmVzdWx0LnN0YXJ0LmlzT25seURhdGUoKVxuICAgICAgICAgICAgPyBtZXJnZURhdGVUaW1lUmVzdWx0KGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpXG4gICAgICAgICAgICA6IG1lcmdlRGF0ZVRpbWVSZXN1bHQobmV4dFJlc3VsdCwgY3VycmVudFJlc3VsdCk7XG4gICAgICAgIHJlc3VsdC5pbmRleCA9IGN1cnJlbnRSZXN1bHQuaW5kZXg7XG4gICAgICAgIHJlc3VsdC50ZXh0ID0gY3VycmVudFJlc3VsdC50ZXh0ICsgdGV4dEJldHdlZW4gKyBuZXh0UmVzdWx0LnRleHQ7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9QWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgQWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lciBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3JlZmluZXJzL0Fic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTWVyZ2VEYXRlVGltZVJlZmluZXIgZXh0ZW5kcyBBYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyIHtcbiAgICBwYXR0ZXJuQmV0d2VlbigpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoXCJeXFxcXHMqKFR8YXR8YWZ0ZXJ8YmVmb3JlfG9ufG9mfCx8LXxcXFxcLnziiJl8Oik/XFxcXHMqJFwiKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IHRvVGltZXpvbmVPZmZzZXQgfSBmcm9tIFwiLi4vLi4vdGltZXpvbmUuanNcIjtcbmNvbnN0IFRJTUVaT05FX05BTUVfUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCJeXFxcXHMqLD9cXFxccypcXFxcKD8oW0EtWl17Miw0fSlcXFxcKT8oPz1cXFxcV3wkKVwiLCBcImlcIik7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lciB7XG4gICAgdGltZXpvbmVPdmVycmlkZXM7XG4gICAgY29uc3RydWN0b3IodGltZXpvbmVPdmVycmlkZXMpIHtcbiAgICAgICAgdGhpcy50aW1lem9uZU92ZXJyaWRlcyA9IHRpbWV6b25lT3ZlcnJpZGVzO1xuICAgIH1cbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICBjb25zdCB0aW1lem9uZU92ZXJyaWRlcyA9IGNvbnRleHQub3B0aW9uLnRpbWV6b25lcyA/PyB7fTtcbiAgICAgICAgcmVzdWx0cy5mb3JFYWNoKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcocmVzdWx0LmluZGV4ICsgcmVzdWx0LnRleHQubGVuZ3RoKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gVElNRVpPTkVfTkFNRV9QQVRURVJOLmV4ZWMoc3VmZml4KTtcbiAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0aW1lem9uZUFiYnIgPSBtYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgY29uc3QgcmVmRGF0ZSA9IHJlc3VsdC5zdGFydC5kYXRlKCkgPz8gcmVzdWx0LnJlZkRhdGUgPz8gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHR6T3ZlcnJpZGVzID0geyAuLi50aGlzLnRpbWV6b25lT3ZlcnJpZGVzLCAuLi50aW1lem9uZU92ZXJyaWRlcyB9O1xuICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkVGltZXpvbmVPZmZzZXQgPSB0b1RpbWV6b25lT2Zmc2V0KHRpbWV6b25lQWJiciwgcmVmRGF0ZSwgdHpPdmVycmlkZXMpO1xuICAgICAgICAgICAgaWYgKGV4dHJhY3RlZFRpbWV6b25lT2Zmc2V0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXh0cmFjdGluZyB0aW1lem9uZTogJyR7dGltZXpvbmVBYmJyfScgaW50bzogJHtleHRyYWN0ZWRUaW1lem9uZU9mZnNldH0gZm9yOiAke3Jlc3VsdC5zdGFydH1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFRpbWV6b25lT2Zmc2V0ID0gcmVzdWx0LnN0YXJ0LmdldChcInRpbWV6b25lT2Zmc2V0XCIpO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRUaW1lem9uZU9mZnNldCAhPT0gbnVsbCAmJiBleHRyYWN0ZWRUaW1lem9uZU9mZnNldCAhPSBjdXJyZW50VGltZXpvbmVPZmZzZXQpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRpbWV6b25lQWJiciAhPSBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc09ubHlEYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZXpvbmVBYmJyICE9IG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQudGV4dCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIGV4dHJhY3RlZFRpbWV6b25lT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXN1bHQuZW5kICE9IG51bGwgJiYgIXJlc3VsdC5lbmQuaXNDZXJ0YWluKFwidGltZXpvbmVPZmZzZXRcIikpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIGV4dHJhY3RlZFRpbWV6b25lT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUV4dHJhY3RUaW1lem9uZUFiYnJSZWZpbmVyLmpzLm1hcCIsImNvbnN0IFRJTUVaT05FX09GRlNFVF9QQVRURVJOID0gbmV3IFJlZ0V4cChcIl5cXFxccyooPzpcXFxcKD8oPzpHTVR8VVRDKVxcXFxzPyk/KFsrLV0pKFxcXFxkezEsMn0pKD86Oj8oXFxcXGR7Mn0pKT9cXFxcKT9cIiwgXCJpXCIpO1xuY29uc3QgVElNRVpPTkVfT0ZGU0VUX1NJR05fR1JPVVAgPSAxO1xuY29uc3QgVElNRVpPTkVfT0ZGU0VUX0hPVVJfT0ZGU0VUX0dST1VQID0gMjtcbmNvbnN0IFRJTUVaT05FX09GRlNFVF9NSU5VVEVfT0ZGU0VUX0dST1VQID0gMztcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIge1xuICAgIHJlZmluZShjb250ZXh0LCByZXN1bHRzKSB7XG4gICAgICAgIHJlc3VsdHMuZm9yRWFjaChmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3VmZml4ID0gY29udGV4dC50ZXh0LnN1YnN0cmluZyhyZXN1bHQuaW5kZXggKyByZXN1bHQudGV4dC5sZW5ndGgpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBUSU1FWk9ORV9PRkZTRVRfUEFUVEVSTi5leGVjKHN1ZmZpeCk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEV4dHJhY3RpbmcgdGltZXpvbmU6ICcke21hdGNoWzBdfScgaW50byA6ICR7cmVzdWx0fWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBob3VyT2Zmc2V0ID0gcGFyc2VJbnQobWF0Y2hbVElNRVpPTkVfT0ZGU0VUX0hPVVJfT0ZGU0VUX0dST1VQXSk7XG4gICAgICAgICAgICBjb25zdCBtaW51dGVPZmZzZXQgPSBwYXJzZUludChtYXRjaFtUSU1FWk9ORV9PRkZTRVRfTUlOVVRFX09GRlNFVF9HUk9VUF0gfHwgXCIwXCIpO1xuICAgICAgICAgICAgbGV0IHRpbWV6b25lT2Zmc2V0ID0gaG91ck9mZnNldCAqIDYwICsgbWludXRlT2Zmc2V0O1xuICAgICAgICAgICAgaWYgKHRpbWV6b25lT2Zmc2V0ID4gMTQgKiA2MCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFtUSU1FWk9ORV9PRkZTRVRfU0lHTl9HUk9VUF0gPT09IFwiLVwiKSB7XG4gICAgICAgICAgICAgICAgdGltZXpvbmVPZmZzZXQgPSAtdGltZXpvbmVPZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCB0aW1lem9uZU9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwidGltZXpvbmVPZmZzZXRcIiwgdGltZXpvbmVPZmZzZXQpO1xuICAgICAgICAgICAgcmVzdWx0LnRleHQgKz0gbWF0Y2hbMF07XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyLmpzLm1hcCIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIE92ZXJsYXBSZW1vdmFsUmVmaW5lciB7XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZmlsdGVyZWRSZXN1bHRzID0gW107XG4gICAgICAgIGxldCBwcmV2UmVzdWx0ID0gcmVzdWx0c1swXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSByZXN1bHRzW2ldO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5pbmRleCA+PSBwcmV2UmVzdWx0LmluZGV4ICsgcHJldlJlc3VsdC50ZXh0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGZpbHRlcmVkUmVzdWx0cy5wdXNoKHByZXZSZXN1bHQpO1xuICAgICAgICAgICAgICAgIHByZXZSZXN1bHQgPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQga2VwdCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IG51bGw7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnRleHQubGVuZ3RoID4gcHJldlJlc3VsdC50ZXh0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGtlcHQgPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHByZXZSZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBrZXB0ID0gcHJldlJlc3VsdDtcbiAgICAgICAgICAgICAgICByZW1vdmVkID0gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSByZW1vdmUgJHtyZW1vdmVkfSBieSAke2tlcHR9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHByZXZSZXN1bHQgPSBrZXB0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcmV2UmVzdWx0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIGZpbHRlcmVkUmVzdWx0cy5wdXNoKHByZXZSZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9T3ZlcmxhcFJlbW92YWxSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IFdlZWtkYXkgfSBmcm9tIFwiLi4vdHlwZXMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uL3Jlc3VsdHMuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXJzaW5nQ29tcG9uZW50c0F0V2Vla2RheShyZWZlcmVuY2UsIHdlZWtkYXksIG1vZGlmaWVyKSB7XG4gICAgY29uc3QgcmVmRGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICBjb25zdCBkYXlzVG9XZWVrZGF5ID0gZ2V0RGF5c1RvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5LCBtb2RpZmllcik7XG4gICAgbGV0IGNvbXBvbmVudHMgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlKTtcbiAgICBjb21wb25lbnRzID0gY29tcG9uZW50cy5hZGREdXJhdGlvbkFzSW1wbGllZCh7IGRheTogZGF5c1RvV2Vla2RheSB9KTtcbiAgICBjb21wb25lbnRzLmFzc2lnbihcIndlZWtkYXlcIiwgd2Vla2RheSk7XG4gICAgcmV0dXJuIGNvbXBvbmVudHM7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0RGF5c1RvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5LCBtb2RpZmllcikge1xuICAgIGNvbnN0IHJlZldlZWtkYXkgPSByZWZEYXRlLmdldERheSgpO1xuICAgIHN3aXRjaCAobW9kaWZpZXIpIHtcbiAgICAgICAgY2FzZSBcInRoaXNcIjpcbiAgICAgICAgICAgIHJldHVybiBnZXREYXlzRm9yd2FyZFRvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5KTtcbiAgICAgICAgY2FzZSBcImxhc3RcIjpcbiAgICAgICAgICAgIHJldHVybiBnZXRCYWNrd2FyZERheXNUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSk7XG4gICAgICAgIGNhc2UgXCJuZXh0XCI6XG4gICAgICAgICAgICBpZiAocmVmV2Vla2RheSA9PSBXZWVrZGF5LlNVTkRBWSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB3ZWVrZGF5ID09IFdlZWtkYXkuU1VOREFZID8gNyA6IHdlZWtkYXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVmV2Vla2RheSA9PSBXZWVrZGF5LlNBVFVSREFZKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdlZWtkYXkgPT0gV2Vla2RheS5TQVRVUkRBWSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDc7XG4gICAgICAgICAgICAgICAgaWYgKHdlZWtkYXkgPT0gV2Vla2RheS5TVU5EQVkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiA4O1xuICAgICAgICAgICAgICAgIHJldHVybiAxICsgd2Vla2RheTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3ZWVrZGF5IDwgcmVmV2Vla2RheSAmJiB3ZWVrZGF5ICE9IFdlZWtkYXkuU1VOREFZKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpICsgNztcbiAgICAgICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdldERheXNUb1dlZWtkYXlDbG9zZXN0KHJlZkRhdGUsIHdlZWtkYXkpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldERheXNUb1dlZWtkYXlDbG9zZXN0KHJlZkRhdGUsIHdlZWtkYXkpIHtcbiAgICBjb25zdCBiYWNrd2FyZCA9IGdldEJhY2t3YXJkRGF5c1RvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5KTtcbiAgICBjb25zdCBmb3J3YXJkID0gZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSk7XG4gICAgcmV0dXJuIGZvcndhcmQgPCAtYmFja3dhcmQgPyBmb3J3YXJkIDogYmFja3dhcmQ7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSkge1xuICAgIGNvbnN0IHJlZldlZWtkYXkgPSByZWZEYXRlLmdldERheSgpO1xuICAgIGxldCBmb3J3YXJkQ291bnQgPSB3ZWVrZGF5IC0gcmVmV2Vla2RheTtcbiAgICBpZiAoZm9yd2FyZENvdW50IDwgMCkge1xuICAgICAgICBmb3J3YXJkQ291bnQgKz0gNztcbiAgICB9XG4gICAgcmV0dXJuIGZvcndhcmRDb3VudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRCYWNrd2FyZERheXNUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSkge1xuICAgIGNvbnN0IHJlZldlZWtkYXkgPSByZWZEYXRlLmdldERheSgpO1xuICAgIGxldCBiYWNrd2FyZENvdW50ID0gd2Vla2RheSAtIHJlZldlZWtkYXk7XG4gICAgaWYgKGJhY2t3YXJkQ291bnQgPj0gMCkge1xuICAgICAgICBiYWNrd2FyZENvdW50IC09IDc7XG4gICAgfVxuICAgIHJldHVybiBiYWNrd2FyZENvdW50O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9d2Vla2RheXMuanMubWFwIiwiaW1wb3J0ICogYXMgZGF0ZXMgZnJvbSBcIi4uLy4uL3V0aWxzL2RhdGVzLmpzXCI7XG5pbXBvcnQgeyBpbXBseVNpbWlsYXJEYXRlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2RhdGVzLmpzXCI7XG5pbXBvcnQgeyBhZGREdXJhdGlvbiB9IGZyb20gXCIuLi8uLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuaW1wb3J0IHsgZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkgfSBmcm9tIFwiLi4vLi4vY2FsY3VsYXRpb24vd2Vla2RheXMuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvcndhcmREYXRlUmVmaW5lciB7XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Lm9wdGlvbi5mb3J3YXJkRGF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0cy5mb3JFYWNoKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGxldCByZWZEYXRlID0gY29udGV4dC5yZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzT25seVRpbWUoKSAmJiBjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50ID4gcmVzdWx0LnN0YXJ0LmRhdGUoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZkRhdGUgPSBjb250ZXh0LnJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZWZGb2xsb3dpbmdEYXkgPSBuZXcgRGF0ZShyZWZEYXRlKTtcbiAgICAgICAgICAgICAgICByZWZGb2xsb3dpbmdEYXkuc2V0RGF0ZShyZWZGb2xsb3dpbmdEYXkuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgZGF0ZXMuaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuc3RhcnQsIHJlZkZvbGxvd2luZ0RheSk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gYWRqdXN0ZWQgJHtyZXN1bHR9IHRpbWUgZnJvbSB0aGUgcmVmIGRhdGUgKCR7cmVmRGF0ZX0pIHRvIHRoZSBmb2xsb3dpbmcgZGF5ICgke3JlZkZvbGxvd2luZ0RheX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5lbmQgJiYgcmVzdWx0LmVuZC5pc09ubHlUaW1lKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0ZXMuaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuZW5kLCByZWZGb2xsb3dpbmdEYXkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmRhdGUoKSA+IHJlc3VsdC5lbmQuZGF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWZGb2xsb3dpbmdEYXkuc2V0RGF0ZShyZWZGb2xsb3dpbmdEYXkuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRlcy5pbXBseVNpbWlsYXJEYXRlKHJlc3VsdC5lbmQsIHJlZkZvbGxvd2luZ0RheSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSAmJiByZWZEYXRlID4gcmVzdWx0LnN0YXJ0LmRhdGUoKSkge1xuICAgICAgICAgICAgICAgIGxldCBkYXlzVG9BZGQgPSBnZXREYXlzRm9yd2FyZFRvV2Vla2RheShyZWZEYXRlLCByZXN1bHQuc3RhcnQuZ2V0KFwid2Vla2RheVwiKSkgfHwgNztcbiAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkZWRXZWVrZGF5ID0gYWRkRHVyYXRpb24ocmVmRGF0ZSwgeyBkYXk6IGRheXNUb0FkZCB9KTtcbiAgICAgICAgICAgICAgICBpbXBseVNpbWlsYXJEYXRlKHJlc3VsdC5zdGFydCwgZm9yd2FyZGVkV2Vla2RheSk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gYWRqdXN0ZWQgJHtyZXN1bHR9IHdlZWtkYXkgKCR7cmVzdWx0LnN0YXJ0fSlgKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAmJiByZXN1bHQuc3RhcnQuZGF0ZSgpID4gcmVzdWx0LmVuZC5kYXRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRheXNUb0FkZCA9IGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHJlc3VsdC5zdGFydC5nZXQoXCJ3ZWVrZGF5XCIpKSB8fCA3O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkZWRXZWVrZGF5ID0gYWRkRHVyYXRpb24ocmVmRGF0ZSwgeyBkYXk6IGRheXNUb0FkZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuZW5kLCBmb3J3YXJkZWRXZWVrZGF5KTtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGFkanVzdGVkICR7cmVzdWx0fSB3ZWVrZGF5ICgke3Jlc3VsdC5lbmR9KWApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzRGF0ZVdpdGhVbmtub3duWWVhcigpICYmIHJlZkRhdGUgPiByZXN1bHQuc3RhcnQuZGF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzICYmIHJlZkRhdGUgPiByZXN1bHQuc3RhcnQuZGF0ZSgpOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCByZXN1bHQuc3RhcnQuZ2V0KFwieWVhclwiKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gYWRqdXN0ZWQgJHtyZXN1bHR9IHllYXIgKCR7cmVzdWx0LnN0YXJ0fSlgKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuZW5kICYmICFyZXN1bHQuZW5kLmlzQ2VydGFpbihcInllYXJcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5lbmQuaW1wbHkoXCJ5ZWFyXCIsIHJlc3VsdC5lbmQuZ2V0KFwieWVhclwiKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBhZGp1c3RlZCAke3Jlc3VsdH0gbW9udGggKCR7cmVzdWx0LnN0YXJ0fSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Rm9yd2FyZERhdGVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IEZpbHRlciB9IGZyb20gXCIuLi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVbmxpa2VseUZvcm1hdEZpbHRlciBleHRlbmRzIEZpbHRlciB7XG4gICAgc3RyaWN0TW9kZTtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIGlzVmFsaWQoY29udGV4dCwgcmVzdWx0KSB7XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5yZXBsYWNlKFwiIFwiLCBcIlwiKS5tYXRjaCgvXlxcZCooXFwuXFxkKik/JC8pKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVtb3ZpbmcgdW5saWtlbHkgcmVzdWx0ICcke3Jlc3VsdC50ZXh0fSdgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcmVzdWx0LnN0YXJ0LmlzVmFsaWREYXRlKCkpIHtcbiAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSZW1vdmluZyBpbnZhbGlkIHJlc3VsdDogJHtyZXN1bHR9ICgke3Jlc3VsdC5zdGFydH0pYCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0LmVuZCAmJiAhcmVzdWx0LmVuZC5pc1ZhbGlkRGF0ZSgpKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVtb3ZpbmcgaW52YWxpZCByZXN1bHQ6ICR7cmVzdWx0fSAoJHtyZXN1bHQuZW5kfSlgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0cmljdE1vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzU3RyaWN0TW9kZVZhbGlkKGNvbnRleHQsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlzU3RyaWN0TW9kZVZhbGlkKGNvbnRleHQsIHJlc3VsdCkge1xuICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSkge1xuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYChTdHJpY3QpIFJlbW92aW5nIHdlZWtkYXkgb25seSBjb21wb25lbnQ6ICR7cmVzdWx0fSAoJHtyZXN1bHQuZW5kfSlgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVVubGlrZWx5Rm9ybWF0RmlsdGVyLmpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4vQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIihbMC05XXs0fSlcXFxcLShbMC05XXsxLDJ9KVxcXFwtKFswLTldezEsMn0pXCIgK1xuICAgIFwiKD86VFwiICtcbiAgICBcIihbMC05XXsxLDJ9KTooWzAtOV17MSwyfSlcIiArXG4gICAgXCIoPzpcIiArXG4gICAgXCI6KFswLTldezEsMn0pKD86XFxcXC4oXFxcXGR7MSw0fSkpP1wiICtcbiAgICBcIik/XCIgK1xuICAgIFwiKFwiICtcbiAgICBcIlp8KFsrLV1cXFxcZHsyfSk6PyhcXFxcZHsyfSk/XCIgK1xuICAgIFwiKT9cIiArXG4gICAgXCIpP1wiICtcbiAgICBcIig/PVxcXFxXfCQpXCIsIFwiaVwiKTtcbmNvbnN0IFlFQVJfTlVNQkVSX0dST1VQID0gMTtcbmNvbnN0IE1PTlRIX05VTUJFUl9HUk9VUCA9IDI7XG5jb25zdCBEQVRFX05VTUJFUl9HUk9VUCA9IDM7XG5jb25zdCBIT1VSX05VTUJFUl9HUk9VUCA9IDQ7XG5jb25zdCBNSU5VVEVfTlVNQkVSX0dST1VQID0gNTtcbmNvbnN0IFNFQ09ORF9OVU1CRVJfR1JPVVAgPSA2O1xuY29uc3QgTUlMTElTRUNPTkRfTlVNQkVSX0dST1VQID0gNztcbmNvbnN0IFRaRF9HUk9VUCA9IDg7XG5jb25zdCBUWkRfSE9VUl9PRkZTRVRfR1JPVVAgPSA5O1xuY29uc3QgVFpEX01JTlVURV9PRkZTRVRfR1JPVVAgPSAxMDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIElTT0Zvcm1hdFBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoe1xuICAgICAgICAgICAgXCJ5ZWFyXCI6IHBhcnNlSW50KG1hdGNoW1lFQVJfTlVNQkVSX0dST1VQXSksXG4gICAgICAgICAgICBcIm1vbnRoXCI6IHBhcnNlSW50KG1hdGNoW01PTlRIX05VTUJFUl9HUk9VUF0pLFxuICAgICAgICAgICAgXCJkYXlcIjogcGFyc2VJbnQobWF0Y2hbREFURV9OVU1CRVJfR1JPVVBdKSxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChtYXRjaFtIT1VSX05VTUJFUl9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIHBhcnNlSW50KG1hdGNoW0hPVVJfTlVNQkVSX0dST1VQXSkpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtaW51dGVcIiwgcGFyc2VJbnQobWF0Y2hbTUlOVVRFX05VTUJFUl9HUk9VUF0pKTtcbiAgICAgICAgICAgIGlmIChtYXRjaFtTRUNPTkRfTlVNQkVSX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJzZWNvbmRcIiwgcGFyc2VJbnQobWF0Y2hbU0VDT05EX05VTUJFUl9HUk9VUF0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFtNSUxMSVNFQ09ORF9OVU1CRVJfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1pbGxpc2Vjb25kXCIsIHBhcnNlSW50KG1hdGNoW01JTExJU0VDT05EX05VTUJFUl9HUk9VUF0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFtUWkRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hbVFpEX0hPVVJfT0ZGU0VUX0dST1VQXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBob3VyT2Zmc2V0ID0gcGFyc2VJbnQobWF0Y2hbVFpEX0hPVVJfT0ZGU0VUX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBtaW51dGVPZmZzZXQgPSAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hbVFpEX01JTlVURV9PRkZTRVRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbnV0ZU9mZnNldCA9IHBhcnNlSW50KG1hdGNoW1RaRF9NSU5VVEVfT0ZGU0VUX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ID0gaG91ck9mZnNldCAqIDYwO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2Zmc2V0IDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0IC09IG1pbnV0ZU9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldCArPSBtaW51dGVPZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCBvZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnRzLmFkZFRhZyhcInBhcnNlci9JU09Gb3JtYXRQYXJzZXJcIik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9SVNPRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uL2Fic3RyYWN0UmVmaW5lcnMuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIgZXh0ZW5kcyBNZXJnaW5nUmVmaW5lciB7XG4gICAgbWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IG5ld1Jlc3VsdCA9IG5leHRSZXN1bHQuY2xvbmUoKTtcbiAgICAgICAgbmV3UmVzdWx0LmluZGV4ID0gY3VycmVudFJlc3VsdC5pbmRleDtcbiAgICAgICAgbmV3UmVzdWx0LnRleHQgPSBjdXJyZW50UmVzdWx0LnRleHQgKyB0ZXh0QmV0d2VlbiArIG5ld1Jlc3VsdC50ZXh0O1xuICAgICAgICBuZXdSZXN1bHQuc3RhcnQuYXNzaWduKFwid2Vla2RheVwiLCBjdXJyZW50UmVzdWx0LnN0YXJ0LmdldChcIndlZWtkYXlcIikpO1xuICAgICAgICBpZiAobmV3UmVzdWx0LmVuZCkge1xuICAgICAgICAgICAgbmV3UmVzdWx0LmVuZC5hc3NpZ24oXCJ3ZWVrZGF5XCIsIGN1cnJlbnRSZXN1bHQuc3RhcnQuZ2V0KFwid2Vla2RheVwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld1Jlc3VsdDtcbiAgICB9XG4gICAgc2hvdWxkTWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IHdlZWtkYXlUaGVuTm9ybWFsRGF0ZSA9IGN1cnJlbnRSZXN1bHQuc3RhcnQuaXNPbmx5V2Vla2RheUNvbXBvbmVudCgpICYmXG4gICAgICAgICAgICAhY3VycmVudFJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJob3VyXCIpICYmXG4gICAgICAgICAgICBuZXh0UmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcImRheVwiKTtcbiAgICAgICAgcmV0dXJuIHdlZWtkYXlUaGVuTm9ybWFsRGF0ZSAmJiB0ZXh0QmV0d2Vlbi5tYXRjaCgvXiw/XFxzKiQvKSAhPSBudWxsO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPU1lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIuanMubWFwIiwiaW1wb3J0IEV4dHJhY3RUaW1lem9uZUFiYnJSZWZpbmVyIGZyb20gXCIuL2NvbW1vbi9yZWZpbmVycy9FeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lci5qc1wiO1xuaW1wb3J0IEV4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL0V4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIuanNcIjtcbmltcG9ydCBPdmVybGFwUmVtb3ZhbFJlZmluZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL092ZXJsYXBSZW1vdmFsUmVmaW5lci5qc1wiO1xuaW1wb3J0IEZvcndhcmREYXRlUmVmaW5lciBmcm9tIFwiLi9jb21tb24vcmVmaW5lcnMvRm9yd2FyZERhdGVSZWZpbmVyLmpzXCI7XG5pbXBvcnQgVW5saWtlbHlGb3JtYXRGaWx0ZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL1VubGlrZWx5Rm9ybWF0RmlsdGVyLmpzXCI7XG5pbXBvcnQgSVNPRm9ybWF0UGFyc2VyIGZyb20gXCIuL2NvbW1vbi9wYXJzZXJzL0lTT0Zvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IE1lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL01lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBpbmNsdWRlQ29tbW9uQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uLCBzdHJpY3RNb2RlID0gZmFsc2UpIHtcbiAgICBjb25maWd1cmF0aW9uLnBhcnNlcnMudW5zaGlmdChuZXcgSVNPRm9ybWF0UGFyc2VyKCkpO1xuICAgIGNvbmZpZ3VyYXRpb24ucmVmaW5lcnMudW5zaGlmdChuZXcgTWVyZ2VXZWVrZGF5Q29tcG9uZW50UmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnVuc2hpZnQobmV3IEV4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy51bnNoaWZ0KG5ldyBPdmVybGFwUmVtb3ZhbFJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy5wdXNoKG5ldyBFeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnB1c2gobmV3IE92ZXJsYXBSZW1vdmFsUmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnB1c2gobmV3IEZvcndhcmREYXRlUmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnB1c2gobmV3IFVubGlrZWx5Rm9ybWF0RmlsdGVyKHN0cmljdE1vZGUpKTtcbiAgICByZXR1cm4gY29uZmlndXJhdGlvbjtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvbmZpZ3VyYXRpb25zLmpzLm1hcCIsImltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IGFzc2lnblNpbWlsYXJEYXRlLCBhc3NpZ25TaW1pbGFyVGltZSwgaW1wbHlTaW1pbGFyVGltZSB9IGZyb20gXCIuLi91dGlscy9kYXRlcy5qc1wiO1xuaW1wb3J0IHsgTWVyaWRpZW0gfSBmcm9tIFwiLi4vdHlwZXMuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBub3cocmVmZXJlbmNlKSB7XG4gICAgY29uc3QgdGFyZ2V0RGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBhc3NpZ25TaW1pbGFyVGltZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCByZWZlcmVuY2UuZ2V0VGltZXpvbmVPZmZzZXQoKSk7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS9ub3dcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0b2RheShyZWZlcmVuY2UpIHtcbiAgICBjb25zdCB0YXJnZXREYXRlID0gcmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGltcGx5U2ltaWxhclRpbWUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBjb21wb25lbnQuZGVsZXRlKFwibWVyaWRpZW1cIik7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS90b2RheVwiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHllc3RlcmRheShyZWZlcmVuY2UpIHtcbiAgICByZXR1cm4gdGhlRGF5QmVmb3JlKHJlZmVyZW5jZSwgMSkuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL3llc3RlcmRheVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0b21vcnJvdyhyZWZlcmVuY2UpIHtcbiAgICByZXR1cm4gdGhlRGF5QWZ0ZXIocmVmZXJlbmNlLCAxKS5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvdG9tb3Jyb3dcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gdGhlRGF5QmVmb3JlKHJlZmVyZW5jZSwgbnVtRGF5KSB7XG4gICAgcmV0dXJuIHRoZURheUFmdGVyKHJlZmVyZW5jZSwgLW51bURheSk7XG59XG5leHBvcnQgZnVuY3Rpb24gdGhlRGF5QWZ0ZXIocmVmZXJlbmNlLCBuRGF5cykge1xuICAgIGNvbnN0IHRhcmdldERhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGNvbnN0IG5ld0RhdGUgPSBuZXcgRGF0ZSh0YXJnZXREYXRlLmdldFRpbWUoKSk7XG4gICAgbmV3RGF0ZS5zZXREYXRlKG5ld0RhdGUuZ2V0RGF0ZSgpICsgbkRheXMpO1xuICAgIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgbmV3RGF0ZSk7XG4gICAgaW1wbHlTaW1pbGFyVGltZShjb21wb25lbnQsIG5ld0RhdGUpO1xuICAgIGNvbXBvbmVudC5kZWxldGUoXCJtZXJpZGllbVwiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRvbmlnaHQocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAyMikge1xuICAgIGNvbnN0IHRhcmdldERhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0RGF0ZSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwiaG91clwiLCBpbXBseUhvdXIpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICBjb21wb25lbnQuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL3RvbmlnaHRcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBsYXN0TmlnaHQocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAwKSB7XG4gICAgbGV0IHRhcmdldERhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGlmICh0YXJnZXREYXRlLmdldEhvdXJzKCkgPCA2KSB7XG4gICAgICAgIHRhcmdldERhdGUgPSBuZXcgRGF0ZSh0YXJnZXREYXRlLmdldFRpbWUoKSAtIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgIH1cbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW5pbmcocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAyMCkge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwiaG91clwiLCBpbXBseUhvdXIpO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvZXZlbmluZ1wiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHllc3RlcmRheUV2ZW5pbmcocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAyMCkge1xuICAgIGxldCB0YXJnZXREYXRlID0gcmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICB0YXJnZXREYXRlID0gbmV3IERhdGUodGFyZ2V0RGF0ZS5nZXRUaW1lKCkgLSAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS95ZXN0ZXJkYXlcIik7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS9ldmVuaW5nXCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gbWlkbmlnaHQocmVmZXJlbmNlKSB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGlmIChyZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCkuZ2V0SG91cnMoKSA+IDIpIHtcbiAgICAgICAgY29tcG9uZW50LmFkZER1cmF0aW9uQXNJbXBsaWVkKHsgZGF5OiAxIH0pO1xuICAgIH1cbiAgICBjb21wb25lbnQuYXNzaWduKFwiaG91clwiLCAwKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvbWlkbmlnaHRcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtb3JuaW5nKHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gNikge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwiaG91clwiLCBpbXBseUhvdXIpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbnV0ZVwiLCAwKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJzZWNvbmRcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgMCk7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS9tb3JuaW5nXCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gYWZ0ZXJub29uKHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gMTUpIHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvYWZ0ZXJub29uXCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gbm9vbihyZWZlcmVuY2UpIHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uQU0pO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJob3VyXCIsIDEyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2Uvbm9vblwiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2FzdWFsUmVmZXJlbmNlcy5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IGFzc2lnblNpbWlsYXJEYXRlIH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL2RhdGVzLmpzXCI7XG5pbXBvcnQgKiBhcyByZWZlcmVuY2VzIGZyb20gXCIuLi8uLi8uLi9jb21tb24vY2FzdWFsUmVmZXJlbmNlcy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IC8obm93fHRvZGF5fHRvbmlnaHR8dG9tb3Jyb3d8b3Zlcm1vcnJvd3x0bXJ8dG1yd3x5ZXN0ZXJkYXl8bGFzdFxccypuaWdodCkoPz1cXFd8JCkvaTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOQ2FzdWFsRGF0ZVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oY29udGV4dCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGxldCB0YXJnZXREYXRlID0gY29udGV4dC5yZWZEYXRlO1xuICAgICAgICBjb25zdCBsb3dlclRleHQgPSBtYXRjaFswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBsZXQgY29tcG9uZW50ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cygpO1xuICAgICAgICBzd2l0Y2ggKGxvd2VyVGV4dCkge1xuICAgICAgICAgICAgY2FzZSBcIm5vd1wiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMubm93KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJ0b2RheVwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMudG9kYXkoY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcInllc3RlcmRheVwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMueWVzdGVyZGF5KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJ0b21vcnJvd1wiOlxuICAgICAgICAgICAgY2FzZSBcInRtclwiOlxuICAgICAgICAgICAgY2FzZSBcInRtcndcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSByZWZlcmVuY2VzLnRvbW9ycm93KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJ0b25pZ2h0XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gcmVmZXJlbmNlcy50b25pZ2h0KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJvdmVybW9ycm93XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gcmVmZXJlbmNlcy50aGVEYXlBZnRlcihjb250ZXh0LnJlZmVyZW5jZSwgMik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGlmIChsb3dlclRleHQubWF0Y2goL2xhc3RcXHMqbmlnaHQvKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0RGF0ZS5nZXRIb3VycygpID4gNikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJldmlvdXNEYXkgPSBuZXcgRGF0ZSh0YXJnZXREYXRlLmdldFRpbWUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91c0RheS5zZXREYXRlKHByZXZpb3VzRGF5LmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0RGF0ZSA9IHByZXZpb3VzRGF5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0RGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbXBvbmVudC5hZGRUYWcoXCJwYXJzZXIvRU5DYXN1YWxEYXRlUGFyc2VyXCIpO1xuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOQ2FzdWFsRGF0ZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCAqIGFzIGNhc3VhbFJlZmVyZW5jZXMgZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9jYXN1YWxSZWZlcmVuY2VzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gLyg/OnRoaXMpP1xcc3swLDN9KG1vcm5pbmd8YWZ0ZXJub29ufGV2ZW5pbmd8bmlnaHR8bWlkbmlnaHR8bWlkZGF5fG5vb24pKD89XFxXfCQpL2k7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTkNhc3VhbFRpbWVQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGxldCBjb21wb25lbnQgPSBudWxsO1xuICAgICAgICBzd2l0Y2ggKG1hdGNoWzFdLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIGNhc2UgXCJhZnRlcm5vb25cIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSBjYXN1YWxSZWZlcmVuY2VzLmFmdGVybm9vbihjb250ZXh0LnJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZXZlbmluZ1wiOlxuICAgICAgICAgICAgY2FzZSBcIm5pZ2h0XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gY2FzdWFsUmVmZXJlbmNlcy5ldmVuaW5nKGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJtaWRuaWdodFwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IGNhc3VhbFJlZmVyZW5jZXMubWlkbmlnaHQoY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIm1vcm5pbmdcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSBjYXN1YWxSZWZlcmVuY2VzLm1vcm5pbmcoY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIm5vb25cIjpcbiAgICAgICAgICAgIGNhc2UgXCJtaWRkYXlcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSBjYXN1YWxSZWZlcmVuY2VzLm5vb24oY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5hZGRUYWcoXCJwYXJzZXIvRU5DYXN1YWxUaW1lUGFyc2VyXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5DYXN1YWxUaW1lUGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IFdFRUtEQVlfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IGNyZWF0ZVBhcnNpbmdDb21wb25lbnRzQXRXZWVrZGF5IH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL3dlZWtkYXlzLmpzXCI7XG5pbXBvcnQgeyBXZWVrZGF5IH0gZnJvbSBcIi4uLy4uLy4uL3R5cGVzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIig/Oig/OlxcXFwsfFxcXFwofFxcXFzvvIgpXFxcXHMqKT9cIiArXG4gICAgXCIoPzpvblxcXFxzKj8pP1wiICtcbiAgICBcIig/Oih0aGlzfGxhc3R8cGFzdHxuZXh0KVxcXFxzKik/XCIgK1xuICAgIGAoJHttYXRjaEFueVBhdHRlcm4oV0VFS0RBWV9ESUNUSU9OQVJZKX18d2Vla2VuZHx3ZWVrZGF5KWAgK1xuICAgIFwiKD86XFxcXHMqKD86XFxcXCx8XFxcXCl8XFxcXO+8iSkpP1wiICtcbiAgICBcIig/OlxcXFxzKig/Om9mXFxcXHMqKT8odGhpc3xsYXN0fHBhc3R8bmV4dClcXFxccyp3ZWVrKT9cIiArXG4gICAgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBQUkVGSVhfR1JPVVAgPSAxO1xuY29uc3QgV0VFS0RBWV9HUk9VUCA9IDI7XG5jb25zdCBQT1NURklYX0dST1VQID0gMztcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOV2Vla2RheVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcHJlZml4ID0gbWF0Y2hbUFJFRklYX0dST1VQXTtcbiAgICAgICAgY29uc3QgcG9zdGZpeCA9IG1hdGNoW1BPU1RGSVhfR1JPVVBdO1xuICAgICAgICBsZXQgbW9kaWZpZXJXb3JkID0gcHJlZml4IHx8IHBvc3RmaXg7XG4gICAgICAgIG1vZGlmaWVyV29yZCA9IG1vZGlmaWVyV29yZCB8fCBcIlwiO1xuICAgICAgICBtb2RpZmllcldvcmQgPSBtb2RpZmllcldvcmQudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgbGV0IG1vZGlmaWVyID0gbnVsbDtcbiAgICAgICAgaWYgKG1vZGlmaWVyV29yZCA9PSBcImxhc3RcIiB8fCBtb2RpZmllcldvcmQgPT0gXCJwYXN0XCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJsYXN0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobW9kaWZpZXJXb3JkID09IFwibmV4dFwiKSB7XG4gICAgICAgICAgICBtb2RpZmllciA9IFwibmV4dFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1vZGlmaWVyV29yZCA9PSBcInRoaXNcIikge1xuICAgICAgICAgICAgbW9kaWZpZXIgPSBcInRoaXNcIjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB3ZWVrZGF5X3dvcmQgPSBtYXRjaFtXRUVLREFZX0dST1VQXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBsZXQgd2Vla2RheTtcbiAgICAgICAgaWYgKFdFRUtEQVlfRElDVElPTkFSWVt3ZWVrZGF5X3dvcmRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHdlZWtkYXkgPSBXRUVLREFZX0RJQ1RJT05BUllbd2Vla2RheV93b3JkXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3ZWVrZGF5X3dvcmQgPT0gXCJ3ZWVrZW5kXCIpIHtcbiAgICAgICAgICAgIHdlZWtkYXkgPSBtb2RpZmllciA9PSBcImxhc3RcIiA/IFdlZWtkYXkuU1VOREFZIDogV2Vla2RheS5TQVRVUkRBWTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3ZWVrZGF5X3dvcmQgPT0gXCJ3ZWVrZGF5XCIpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlZldlZWtkYXkgPSBjb250ZXh0LnJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKS5nZXREYXkoKTtcbiAgICAgICAgICAgIGlmIChyZWZXZWVrZGF5ID09IFdlZWtkYXkuU1VOREFZIHx8IHJlZldlZWtkYXkgPT0gV2Vla2RheS5TQVRVUkRBWSkge1xuICAgICAgICAgICAgICAgIHdlZWtkYXkgPSBtb2RpZmllciA9PSBcImxhc3RcIiA/IFdlZWtkYXkuRlJJREFZIDogV2Vla2RheS5NT05EQVk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB3ZWVrZGF5ID0gcmVmV2Vla2RheSAtIDE7XG4gICAgICAgICAgICAgICAgd2Vla2RheSA9IG1vZGlmaWVyID09IFwibGFzdFwiID8gd2Vla2RheSAtIDEgOiB3ZWVrZGF5ICsgMTtcbiAgICAgICAgICAgICAgICB3ZWVrZGF5ID0gKHdlZWtkYXkgJSA1KSArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3JlYXRlUGFyc2luZ0NvbXBvbmVudHNBdFdlZWtkYXkoY29udGV4dC5yZWZlcmVuY2UsIHdlZWtkYXksIG1vZGlmaWVyKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTldlZWtkYXlQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgVElNRV9VTklUX0RJQ1RJT05BUlkgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cyB9IGZyb20gXCIuLi8uLi8uLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKHRoaXN8bGFzdHxwYXN0fG5leHR8YWZ0ZXJcXFxccyp0aGlzKVxcXFxzKigke21hdGNoQW55UGF0dGVybihUSU1FX1VOSVRfRElDVElPTkFSWSl9KSg/PVxcXFxzKilgICsgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBNT0RJRklFUl9XT1JEX0dST1VQID0gMTtcbmNvbnN0IFJFTEFUSVZFX1dPUkRfR1JPVVAgPSAyO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5SZWxhdGl2ZURhdGVGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IG1vZGlmaWVyID0gbWF0Y2hbTU9ESUZJRVJfV09SRF9HUk9VUF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgdW5pdFdvcmQgPSBtYXRjaFtSRUxBVElWRV9XT1JEX0dST1VQXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCB0aW1ldW5pdCA9IFRJTUVfVU5JVF9ESUNUSU9OQVJZW3VuaXRXb3JkXTtcbiAgICAgICAgaWYgKG1vZGlmaWVyID09IFwibmV4dFwiIHx8IG1vZGlmaWVyLnN0YXJ0c1dpdGgoXCJhZnRlclwiKSkge1xuICAgICAgICAgICAgY29uc3QgdGltZVVuaXRzID0ge307XG4gICAgICAgICAgICB0aW1lVW5pdHNbdGltZXVuaXRdID0gMTtcbiAgICAgICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHRpbWVVbml0cyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1vZGlmaWVyID09IFwibGFzdFwiIHx8IG1vZGlmaWVyID09IFwicGFzdFwiKSB7XG4gICAgICAgICAgICBjb25zdCB0aW1lVW5pdHMgPSB7fTtcbiAgICAgICAgICAgIHRpbWVVbml0c1t0aW1ldW5pdF0gPSAtMTtcbiAgICAgICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHRpbWVVbml0cyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoKTtcbiAgICAgICAgbGV0IGRhdGUgPSBuZXcgRGF0ZShjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50LmdldFRpbWUoKSk7XG4gICAgICAgIGlmICh1bml0V29yZC5tYXRjaCgvd2Vlay9pKSkge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gZGF0ZS5nZXREYXkoKSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodW5pdFdvcmQubWF0Y2goL21vbnRoL2kpKSB7XG4gICAgICAgICAgICBkYXRlLnNldERhdGUoMSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1bml0V29yZC5tYXRjaCgveWVhci9pKSkge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKDEpO1xuICAgICAgICAgICAgZGF0ZS5zZXRNb250aCgwKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5SZWxhdGl2ZURhdGVGb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgZmluZE1vc3RMaWtlbHlBRFllYXIsIGZpbmRZZWFyQ2xvc2VzdFRvUmVmIH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIihbXlxcXFxkXXxeKVwiICtcbiAgICBcIihbMC0zXXswLDF9WzAtOV17MX0pW1xcXFwvXFxcXC5cXFxcLV0oWzAtM117MCwxfVswLTldezF9KVwiICtcbiAgICBcIig/OltcXFxcL1xcXFwuXFxcXC1dKFswLTldezR9fFswLTldezJ9KSk/XCIgK1xuICAgIFwiKFxcXFxXfCQpXCIsIFwiaVwiKTtcbmNvbnN0IE9QRU5JTkdfR1JPVVAgPSAxO1xuY29uc3QgRU5ESU5HX0dST1VQID0gNTtcbmNvbnN0IEZJUlNUX05VTUJFUlNfR1JPVVAgPSAyO1xuY29uc3QgU0VDT05EX05VTUJFUlNfR1JPVVAgPSAzO1xuY29uc3QgWUVBUl9HUk9VUCA9IDQ7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTbGFzaERhdGVGb3JtYXRQYXJzZXIge1xuICAgIGdyb3VwTnVtYmVyTW9udGg7XG4gICAgZ3JvdXBOdW1iZXJEYXk7XG4gICAgY29uc3RydWN0b3IobGl0dGxlRW5kaWFuKSB7XG4gICAgICAgIHRoaXMuZ3JvdXBOdW1iZXJNb250aCA9IGxpdHRsZUVuZGlhbiA/IFNFQ09ORF9OVU1CRVJTX0dST1VQIDogRklSU1RfTlVNQkVSU19HUk9VUDtcbiAgICAgICAgdGhpcy5ncm91cE51bWJlckRheSA9IGxpdHRsZUVuZGlhbiA/IEZJUlNUX05VTUJFUlNfR1JPVVAgOiBTRUNPTkRfTlVNQkVSU19HUk9VUDtcbiAgICB9XG4gICAgcGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoW09QRU5JTkdfR1JPVVBdLmxlbmd0aDtcbiAgICAgICAgY29uc3QgaW5kZXhFbmQgPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCAtIG1hdGNoW0VORElOR19HUk9VUF0ubGVuZ3RoO1xuICAgICAgICBpZiAoaW5kZXggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0QmVmb3JlID0gY29udGV4dC50ZXh0LnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICAgICAgICBpZiAodGV4dEJlZm9yZS5tYXRjaChcIlxcXFxkLz8kXCIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleEVuZCA8IGNvbnRleHQudGV4dC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHRBZnRlciA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcoaW5kZXhFbmQpO1xuICAgICAgICAgICAgaWYgKHRleHRBZnRlci5tYXRjaChcIl4vP1xcXFxkXCIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRleHQgPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKGluZGV4LCBpbmRleEVuZCk7XG4gICAgICAgIGlmICh0ZXh0Lm1hdGNoKC9eXFxkXFwuXFxkJC8pIHx8IHRleHQubWF0Y2goL15cXGRcXC5cXGR7MSwyfVxcLlxcZHsxLDJ9XFxzKiQvKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghbWF0Y2hbWUVBUl9HUk9VUF0gJiYgdGV4dC5pbmRleE9mKFwiL1wiKSA8IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQoaW5kZXgsIHRleHQpO1xuICAgICAgICBsZXQgbW9udGggPSBwYXJzZUludChtYXRjaFt0aGlzLmdyb3VwTnVtYmVyTW9udGhdKTtcbiAgICAgICAgbGV0IGRheSA9IHBhcnNlSW50KG1hdGNoW3RoaXMuZ3JvdXBOdW1iZXJEYXldKTtcbiAgICAgICAgaWYgKG1vbnRoIDwgMSB8fCBtb250aCA+IDEyKSB7XG4gICAgICAgICAgICBpZiAobW9udGggPiAxMikge1xuICAgICAgICAgICAgICAgIGlmIChkYXkgPj0gMSAmJiBkYXkgPD0gMTIgJiYgbW9udGggPD0gMzEpIHtcbiAgICAgICAgICAgICAgICAgICAgW2RheSwgbW9udGhdID0gW21vbnRoLCBkYXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkYXkgPCAxIHx8IGRheSA+IDMxKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIGRheSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBtb250aCk7XG4gICAgICAgIGlmIChtYXRjaFtZRUFSX0dST1VQXSkge1xuICAgICAgICAgICAgY29uc3QgcmF3WWVhck51bWJlciA9IHBhcnNlSW50KG1hdGNoW1lFQVJfR1JPVVBdKTtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBmaW5kTW9zdExpa2VseUFEWWVhcihyYXdZZWFyTnVtYmVyKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IGZpbmRZZWFyQ2xvc2VzdFRvUmVmKGNvbnRleHQucmVmRGF0ZSwgZGF5LCBtb250aCk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQuYWRkVGFnKFwicGFyc2VyL1NsYXNoRGF0ZUZvcm1hdFBhcnNlclwiKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1TbGFzaERhdGVGb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgVElNRV9VTklUU19QQVRURVJOLCBwYXJzZUR1cmF0aW9uLCBUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuaW1wb3J0IHsgcmV2ZXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKHRoaXN8bGFzdHxwYXN0fG5leHR8YWZ0ZXJ8XFxcXCt8LSlcXFxccyooJHtUSU1FX1VOSVRTX1BBVFRFUk59KSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgUEFUVEVSTl9OT19BQkJSID0gbmV3IFJlZ0V4cChgKHRoaXN8bGFzdHxwYXN0fG5leHR8YWZ0ZXJ8XFxcXCt8LSlcXFxccyooJHtUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTn0pKD89XFxcXFd8JClgLCBcImlcIik7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlRpbWVVbml0Q2FzdWFsUmVsYXRpdmVGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgYWxsb3dBYmJyZXZpYXRpb25zO1xuICAgIGNvbnN0cnVjdG9yKGFsbG93QWJicmV2aWF0aW9ucyA9IHRydWUpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hbGxvd0FiYnJldmlhdGlvbnMgPSBhbGxvd0FiYnJldmlhdGlvbnM7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWxsb3dBYmJyZXZpYXRpb25zID8gUEFUVEVSTiA6IFBBVFRFUk5fTk9fQUJCUjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHByZWZpeCA9IG1hdGNoWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGxldCBkdXJhdGlvbiA9IHBhcnNlRHVyYXRpb24obWF0Y2hbMl0pO1xuICAgICAgICBpZiAoIWR1cmF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKHByZWZpeCkge1xuICAgICAgICAgICAgY2FzZSBcImxhc3RcIjpcbiAgICAgICAgICAgIGNhc2UgXCJwYXN0XCI6XG4gICAgICAgICAgICBjYXNlIFwiLVwiOlxuICAgICAgICAgICAgICAgIGR1cmF0aW9uID0gcmV2ZXJzZUR1cmF0aW9uKGR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCBkdXJhdGlvbik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5UaW1lVW5pdENhc3VhbFJlbGF0aXZlRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cywgUGFyc2luZ1Jlc3VsdCwgUmVmZXJlbmNlV2l0aFRpbWV6b25lIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IHBhcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyByZXZlcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vLi4vLi4vY2FsY3VsYXRpb24vZHVyYXRpb24uanNcIjtcbmZ1bmN0aW9uIElzUG9zaXRpdmVGb2xsb3dpbmdSZWZlcmVuY2UocmVzdWx0KSB7XG4gICAgcmV0dXJuIHJlc3VsdC50ZXh0Lm1hdGNoKC9eWystXS9pKSAhPSBudWxsO1xufVxuZnVuY3Rpb24gSXNOZWdhdGl2ZUZvbGxvd2luZ1JlZmVyZW5jZShyZXN1bHQpIHtcbiAgICByZXR1cm4gcmVzdWx0LnRleHQubWF0Y2goL14tL2kpICE9IG51bGw7XG59XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyIGV4dGVuZHMgTWVyZ2luZ1JlZmluZXIge1xuICAgIHNob3VsZE1lcmdlUmVzdWx0cyh0ZXh0QmV0d2VlbiwgY3VycmVudFJlc3VsdCwgbmV4dFJlc3VsdCkge1xuICAgICAgICBpZiAoIXRleHRCZXR3ZWVuLm1hdGNoKC9eXFxzKiQvaSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSXNQb3NpdGl2ZUZvbGxvd2luZ1JlZmVyZW5jZShuZXh0UmVzdWx0KSB8fCBJc05lZ2F0aXZlRm9sbG93aW5nUmVmZXJlbmNlKG5leHRSZXN1bHQpO1xuICAgIH1cbiAgICBtZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQsIGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHRpbWVVbml0cyA9IHBhcnNlRHVyYXRpb24obmV4dFJlc3VsdC50ZXh0KTtcbiAgICAgICAgaWYgKElzTmVnYXRpdmVGb2xsb3dpbmdSZWZlcmVuY2UobmV4dFJlc3VsdCkpIHtcbiAgICAgICAgICAgIHRpbWVVbml0cyA9IHJldmVyc2VEdXJhdGlvbih0aW1lVW5pdHMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoUmVmZXJlbmNlV2l0aFRpbWV6b25lLmZyb21EYXRlKGN1cnJlbnRSZXN1bHQuc3RhcnQuZGF0ZSgpKSwgdGltZVVuaXRzKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQYXJzaW5nUmVzdWx0KGN1cnJlbnRSZXN1bHQucmVmZXJlbmNlLCBjdXJyZW50UmVzdWx0LmluZGV4LCBgJHtjdXJyZW50UmVzdWx0LnRleHR9JHt0ZXh0QmV0d2Vlbn0ke25leHRSZXN1bHQudGV4dH1gLCBjb21wb25lbnRzKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cywgUGFyc2luZ1Jlc3VsdCwgUmVmZXJlbmNlV2l0aFRpbWV6b25lIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IHBhcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyByZXZlcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vLi4vLi4vY2FsY3VsYXRpb24vZHVyYXRpb24uanNcIjtcbmZ1bmN0aW9uIGhhc0ltcGxpZWRFYXJsaWVyUmVmZXJlbmNlRGF0ZShyZXN1bHQpIHtcbiAgICByZXR1cm4gcmVzdWx0LnRleHQubWF0Y2goL1xccysoYmVmb3JlfGZyb20pJC9pKSAhPSBudWxsO1xufVxuZnVuY3Rpb24gaGFzSW1wbGllZExhdGVyUmVmZXJlbmNlRGF0ZShyZXN1bHQpIHtcbiAgICByZXR1cm4gcmVzdWx0LnRleHQubWF0Y2goL1xccysoYWZ0ZXJ8c2luY2UpJC9pKSAhPSBudWxsO1xufVxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5NZXJnZVJlbGF0aXZlRm9sbG93QnlEYXRlUmVmaW5lciBleHRlbmRzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICBwYXR0ZXJuQmV0d2VlbigpIHtcbiAgICAgICAgcmV0dXJuIC9eXFxzKiQvaTtcbiAgICB9XG4gICAgc2hvdWxkTWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIGlmICghdGV4dEJldHdlZW4ubWF0Y2godGhpcy5wYXR0ZXJuQmV0d2VlbigpKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaGFzSW1wbGllZEVhcmxpZXJSZWZlcmVuY2VEYXRlKGN1cnJlbnRSZXN1bHQpICYmICFoYXNJbXBsaWVkTGF0ZXJSZWZlcmVuY2VEYXRlKGN1cnJlbnRSZXN1bHQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICEhbmV4dFJlc3VsdC5zdGFydC5nZXQoXCJkYXlcIikgJiYgISFuZXh0UmVzdWx0LnN0YXJ0LmdldChcIm1vbnRoXCIpICYmICEhbmV4dFJlc3VsdC5zdGFydC5nZXQoXCJ5ZWFyXCIpO1xuICAgIH1cbiAgICBtZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgbGV0IGR1cmF0aW9uID0gcGFyc2VEdXJhdGlvbihjdXJyZW50UmVzdWx0LnRleHQpO1xuICAgICAgICBpZiAoaGFzSW1wbGllZEVhcmxpZXJSZWZlcmVuY2VEYXRlKGN1cnJlbnRSZXN1bHQpKSB7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IHJldmVyc2VEdXJhdGlvbihkdXJhdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IFBhcnNpbmdDb21wb25lbnRzLmNyZWF0ZVJlbGF0aXZlRnJvbVJlZmVyZW5jZShSZWZlcmVuY2VXaXRoVGltZXpvbmUuZnJvbURhdGUobmV4dFJlc3VsdC5zdGFydC5kYXRlKCkpLCBkdXJhdGlvbik7XG4gICAgICAgIHJldHVybiBuZXcgUGFyc2luZ1Jlc3VsdChuZXh0UmVzdWx0LnJlZmVyZW5jZSwgY3VycmVudFJlc3VsdC5pbmRleCwgYCR7Y3VycmVudFJlc3VsdC50ZXh0fSR7dGV4dEJldHdlZW59JHtuZXh0UmVzdWx0LnRleHR9YCwgY29tcG9uZW50cyk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5NZXJnZVJlbGF0aXZlRm9sbG93QnlEYXRlUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgeyBZRUFSX1BBVFRFUk4sIHBhcnNlWWVhciB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmNvbnN0IFlFQVJfU1VGRklYX1BBVFRFUk4gPSBuZXcgUmVnRXhwKGBeXFxcXHMqKCR7WUVBUl9QQVRURVJOfSlgLCBcImlcIik7XG5jb25zdCBZRUFSX0dST1VQID0gMTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVORXh0cmFjdFllYXJTdWZmaXhSZWZpbmVyIHtcbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICByZXN1bHRzLmZvckVhY2goZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQuc3RhcnQuaXNEYXRlV2l0aFVua25vd25ZZWFyKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzdWZmaXggPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKHJlc3VsdC5pbmRleCArIHJlc3VsdC50ZXh0Lmxlbmd0aCk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IFlFQVJfU1VGRklYX1BBVFRFUk4uZXhlYyhzdWZmaXgpO1xuICAgICAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFswXS50cmltKCkubGVuZ3RoIDw9IDMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXh0cmFjdGluZyB5ZWFyOiAnJHttYXRjaFswXX0nIGludG8gOiAke3Jlc3VsdH1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IHBhcnNlWWVhcihtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgeWVhcik7XG4gICAgICAgICAgICByZXN1bHQudGV4dCArPSBtYXRjaFswXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVORXh0cmFjdFllYXJTdWZmaXhSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IEZpbHRlciB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vYWJzdHJhY3RSZWZpbmVycy5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5Vbmxpa2VseUZvcm1hdEZpbHRlciBleHRlbmRzIEZpbHRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgfVxuICAgIGlzVmFsaWQoY29udGV4dCwgcmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IHRleHQgPSByZXN1bHQudGV4dC50cmltKCk7XG4gICAgICAgIGlmICh0ZXh0ID09PSBjb250ZXh0LnRleHQudHJpbSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGV4dC50b0xvd2VyQ2FzZSgpID09PSBcIm1heVwiKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0QmVmb3JlID0gY29udGV4dC50ZXh0LnN1YnN0cmluZygwLCByZXN1bHQuaW5kZXgpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICghdGV4dEJlZm9yZS5tYXRjaCgvXFxiKGluKSQvaSkpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFJlbW92aW5nIHVubGlrZWx5IHJlc3VsdDogJHtyZXN1bHR9YCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0ZXh0LnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoXCJ0aGUgc2Vjb25kXCIpKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0QWZ0ZXIgPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKHJlc3VsdC5pbmRleCArIHJlc3VsdC50ZXh0Lmxlbmd0aCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHRleHRBZnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSZW1vdmluZyB1bmxpa2VseSByZXN1bHQ6ICR7cmVzdWx0fWApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVW5saWtlbHlGb3JtYXRGaWx0ZXIuanMubWFwIiwiaW1wb3J0IEVOVGltZVVuaXRXaXRoaW5Gb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVVbml0V2l0aGluRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5Nb250aE5hbWVMaXR0bGVFbmRpYW5QYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTk1vbnRoTmFtZUxpdHRsZUVuZGlhblBhcnNlci5qc1wiO1xuaW1wb3J0IEVOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5Nb250aE5hbWVNaWRkbGVFbmRpYW5QYXJzZXIuanNcIjtcbmltcG9ydCBFTk1vbnRoTmFtZVBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOTW9udGhOYW1lUGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5ZZWFyTW9udGhEYXlQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlllYXJNb250aERheVBhcnNlci5qc1wiO1xuaW1wb3J0IEVOU2xhc2hNb250aEZvcm1hdFBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOU2xhc2hNb250aEZvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IEVOVGltZUV4cHJlc3Npb25QYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVFeHByZXNzaW9uUGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5UaW1lVW5pdEFnb0Zvcm1hdFBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTk1lcmdlRGF0ZVJhbmdlUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9FTk1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qc1wiO1xuaW1wb3J0IEVOTWVyZ2VEYXRlVGltZVJlZmluZXIgZnJvbSBcIi4vcmVmaW5lcnMvRU5NZXJnZURhdGVUaW1lUmVmaW5lci5qc1wiO1xuaW1wb3J0IHsgaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24gfSBmcm9tIFwiLi4vLi4vY29uZmlndXJhdGlvbnMuanNcIjtcbmltcG9ydCBFTkNhc3VhbERhdGVQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTkNhc3VhbERhdGVQYXJzZXIuanNcIjtcbmltcG9ydCBFTkNhc3VhbFRpbWVQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTkNhc3VhbFRpbWVQYXJzZXIuanNcIjtcbmltcG9ydCBFTldlZWtkYXlQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTldlZWtkYXlQYXJzZXIuanNcIjtcbmltcG9ydCBFTlJlbGF0aXZlRGF0ZUZvcm1hdFBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOUmVsYXRpdmVEYXRlRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgU2xhc2hEYXRlRm9ybWF0UGFyc2VyIGZyb20gXCIuLi8uLi9jb21tb24vcGFyc2Vycy9TbGFzaERhdGVGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTlRpbWVVbml0Q2FzdWFsUmVsYXRpdmVGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVVbml0Q2FzdWFsUmVsYXRpdmVGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyIGZyb20gXCIuL3JlZmluZXJzL0VOTWVyZ2VSZWxhdGl2ZUFmdGVyRGF0ZVJlZmluZXIuanNcIjtcbmltcG9ydCBFTk1lcmdlUmVsYXRpdmVGb2xsb3dCeURhdGVSZWZpbmVyIGZyb20gXCIuL3JlZmluZXJzL0VOTWVyZ2VSZWxhdGl2ZUZvbGxvd0J5RGF0ZVJlZmluZXIuanNcIjtcbmltcG9ydCBPdmVybGFwUmVtb3ZhbFJlZmluZXIgZnJvbSBcIi4uLy4uL2NvbW1vbi9yZWZpbmVycy9PdmVybGFwUmVtb3ZhbFJlZmluZXIuanNcIjtcbmltcG9ydCBFTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9FTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lci5qc1wiO1xuaW1wb3J0IEVOVW5saWtlbHlGb3JtYXRGaWx0ZXIgZnJvbSBcIi4vcmVmaW5lcnMvRU5Vbmxpa2VseUZvcm1hdEZpbHRlci5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5EZWZhdWx0Q29uZmlndXJhdGlvbiB7XG4gICAgY3JlYXRlQ2FzdWFsQ29uZmlndXJhdGlvbihsaXR0bGVFbmRpYW4gPSBmYWxzZSkge1xuICAgICAgICBjb25zdCBvcHRpb24gPSB0aGlzLmNyZWF0ZUNvbmZpZ3VyYXRpb24oZmFsc2UsIGxpdHRsZUVuZGlhbik7XG4gICAgICAgIG9wdGlvbi5wYXJzZXJzLnB1c2gobmV3IEVOQ2FzdWFsRGF0ZVBhcnNlcigpKTtcbiAgICAgICAgb3B0aW9uLnBhcnNlcnMucHVzaChuZXcgRU5DYXN1YWxUaW1lUGFyc2VyKCkpO1xuICAgICAgICBvcHRpb24ucGFyc2Vycy5wdXNoKG5ldyBFTk1vbnRoTmFtZVBhcnNlcigpKTtcbiAgICAgICAgb3B0aW9uLnBhcnNlcnMucHVzaChuZXcgRU5SZWxhdGl2ZURhdGVGb3JtYXRQYXJzZXIoKSk7XG4gICAgICAgIG9wdGlvbi5wYXJzZXJzLnB1c2gobmV3IEVOVGltZVVuaXRDYXN1YWxSZWxhdGl2ZUZvcm1hdFBhcnNlcigpKTtcbiAgICAgICAgb3B0aW9uLnJlZmluZXJzLnB1c2gobmV3IEVOVW5saWtlbHlGb3JtYXRGaWx0ZXIoKSk7XG4gICAgICAgIHJldHVybiBvcHRpb247XG4gICAgfVxuICAgIGNyZWF0ZUNvbmZpZ3VyYXRpb24oc3RyaWN0TW9kZSA9IHRydWUsIGxpdHRsZUVuZGlhbiA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBpbmNsdWRlQ29tbW9uQ29uZmlndXJhdGlvbih7XG4gICAgICAgICAgICBwYXJzZXJzOiBbXG4gICAgICAgICAgICAgICAgbmV3IFNsYXNoRGF0ZUZvcm1hdFBhcnNlcihsaXR0bGVFbmRpYW4pLFxuICAgICAgICAgICAgICAgIG5ldyBFTlRpbWVVbml0V2l0aGluRm9ybWF0UGFyc2VyKHN0cmljdE1vZGUpLFxuICAgICAgICAgICAgICAgIG5ldyBFTk1vbnRoTmFtZUxpdHRsZUVuZGlhblBhcnNlcigpLFxuICAgICAgICAgICAgICAgIG5ldyBFTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlcihsaXR0bGVFbmRpYW4pLFxuICAgICAgICAgICAgICAgIG5ldyBFTldlZWtkYXlQYXJzZXIoKSxcbiAgICAgICAgICAgICAgICBuZXcgRU5TbGFzaE1vbnRoRm9ybWF0UGFyc2VyKCksXG4gICAgICAgICAgICAgICAgbmV3IEVOVGltZUV4cHJlc3Npb25QYXJzZXIoc3RyaWN0TW9kZSksXG4gICAgICAgICAgICAgICAgbmV3IEVOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIoc3RyaWN0TW9kZSksXG4gICAgICAgICAgICAgICAgbmV3IEVOVGltZVVuaXRMYXRlckZvcm1hdFBhcnNlcihzdHJpY3RNb2RlKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZWZpbmVyczogW25ldyBFTk1lcmdlRGF0ZVRpbWVSZWZpbmVyKCldLFxuICAgICAgICB9LCBzdHJpY3RNb2RlKTtcbiAgICAgICAgb3B0aW9ucy5wYXJzZXJzLnVuc2hpZnQobmV3IEVOWWVhck1vbnRoRGF5UGFyc2VyKHN0cmljdE1vZGUpKTtcbiAgICAgICAgb3B0aW9ucy5yZWZpbmVycy51bnNoaWZ0KG5ldyBFTk1lcmdlUmVsYXRpdmVGb2xsb3dCeURhdGVSZWZpbmVyKCkpO1xuICAgICAgICBvcHRpb25zLnJlZmluZXJzLnVuc2hpZnQobmV3IEVOTWVyZ2VSZWxhdGl2ZUFmdGVyRGF0ZVJlZmluZXIoKSk7XG4gICAgICAgIG9wdGlvbnMucmVmaW5lcnMudW5zaGlmdChuZXcgT3ZlcmxhcFJlbW92YWxSZWZpbmVyKCkpO1xuICAgICAgICBvcHRpb25zLnJlZmluZXJzLnB1c2gobmV3IEVOTWVyZ2VEYXRlVGltZVJlZmluZXIoKSk7XG4gICAgICAgIG9wdGlvbnMucmVmaW5lcnMucHVzaChuZXcgRU5FeHRyYWN0WWVhclN1ZmZpeFJlZmluZXIoKSk7XG4gICAgICAgIG9wdGlvbnMucmVmaW5lcnMucHVzaChuZXcgRU5NZXJnZURhdGVSYW5nZVJlZmluZXIoKSk7XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvbmZpZ3VyYXRpb24uanMubWFwIiwiaW1wb3J0IHsgUmVmZXJlbmNlV2l0aFRpbWV6b25lLCBQYXJzaW5nQ29tcG9uZW50cywgUGFyc2luZ1Jlc3VsdCB9IGZyb20gXCIuL3Jlc3VsdHMuanNcIjtcbmltcG9ydCBFTkRlZmF1bHRDb25maWd1cmF0aW9uIGZyb20gXCIuL2xvY2FsZXMvZW4vY29uZmlndXJhdGlvbi5qc1wiO1xuZXhwb3J0IGNsYXNzIENocm9ubyB7XG4gICAgcGFyc2VycztcbiAgICByZWZpbmVycztcbiAgICBkZWZhdWx0Q29uZmlnID0gbmV3IEVORGVmYXVsdENvbmZpZ3VyYXRpb24oKTtcbiAgICBjb25zdHJ1Y3Rvcihjb25maWd1cmF0aW9uKSB7XG4gICAgICAgIGNvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uIHx8IHRoaXMuZGVmYXVsdENvbmZpZy5jcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCk7XG4gICAgICAgIHRoaXMucGFyc2VycyA9IFsuLi5jb25maWd1cmF0aW9uLnBhcnNlcnNdO1xuICAgICAgICB0aGlzLnJlZmluZXJzID0gWy4uLmNvbmZpZ3VyYXRpb24ucmVmaW5lcnNdO1xuICAgIH1cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDaHJvbm8oe1xuICAgICAgICAgICAgcGFyc2VyczogWy4uLnRoaXMucGFyc2Vyc10sXG4gICAgICAgICAgICByZWZpbmVyczogWy4uLnRoaXMucmVmaW5lcnNdLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcGFyc2VEYXRlKHRleHQsIHJlZmVyZW5jZURhdGUsIG9wdGlvbikge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gdGhpcy5wYXJzZSh0ZXh0LCByZWZlcmVuY2VEYXRlLCBvcHRpb24pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cy5sZW5ndGggPiAwID8gcmVzdWx0c1swXS5zdGFydC5kYXRlKCkgOiBudWxsO1xuICAgIH1cbiAgICBwYXJzZSh0ZXh0LCByZWZlcmVuY2VEYXRlLCBvcHRpb24pIHtcbiAgICAgICAgY29uc3QgY29udGV4dCA9IG5ldyBQYXJzaW5nQ29udGV4dCh0ZXh0LCByZWZlcmVuY2VEYXRlLCBvcHRpb24pO1xuICAgICAgICBsZXQgcmVzdWx0cyA9IFtdO1xuICAgICAgICB0aGlzLnBhcnNlcnMuZm9yRWFjaCgocGFyc2VyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWRSZXN1bHRzID0gQ2hyb25vLmV4ZWN1dGVQYXJzZXIoY29udGV4dCwgcGFyc2VyKTtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChwYXJzZWRSZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlc3VsdHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGEuaW5kZXggLSBiLmluZGV4O1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZWZpbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChyZWZpbmVyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVmaW5lci5yZWZpbmUoY29udGV4dCwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG4gICAgc3RhdGljIGV4ZWN1dGVQYXJzZXIoY29udGV4dCwgcGFyc2VyKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IHBhcnNlci5wYXR0ZXJuKGNvbnRleHQpO1xuICAgICAgICBjb25zdCBvcmlnaW5hbFRleHQgPSBjb250ZXh0LnRleHQ7XG4gICAgICAgIGxldCByZW1haW5pbmdUZXh0ID0gY29udGV4dC50ZXh0O1xuICAgICAgICBsZXQgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgICAgIHdoaWxlIChtYXRjaCkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBtYXRjaC5pbmRleCArIG9yaWdpbmFsVGV4dC5sZW5ndGggLSByZW1haW5pbmdUZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgIG1hdGNoLmluZGV4ID0gaW5kZXg7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIuZXh0cmFjdChjb250ZXh0LCBtYXRjaCk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJlbWFpbmluZ1RleHQgPSBvcmlnaW5hbFRleHQuc3Vic3RyaW5nKG1hdGNoLmluZGV4ICsgMSk7XG4gICAgICAgICAgICAgICAgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcGFyc2VkUmVzdWx0ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQYXJzaW5nUmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcGFyc2VkUmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAocmVzdWx0IGluc3RhbmNlb2YgUGFyc2luZ0NvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICBwYXJzZWRSZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgICAgICAgICBwYXJzZWRSZXN1bHQuc3RhcnQgPSByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYXJzZWRSZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdLCByZXN1bHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcGFyc2VkSW5kZXggPSBwYXJzZWRSZXN1bHQuaW5kZXg7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWRUZXh0ID0gcGFyc2VkUmVzdWx0LnRleHQ7XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IGNvbnNvbGUubG9nKGAke3BhcnNlci5jb25zdHJ1Y3Rvci5uYW1lfSBleHRyYWN0ZWQgKGF0IGluZGV4PSR7cGFyc2VkSW5kZXh9KSAnJHtwYXJzZWRUZXh0fSdgKSk7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2gocGFyc2VkUmVzdWx0KTtcbiAgICAgICAgICAgIHJlbWFpbmluZ1RleHQgPSBvcmlnaW5hbFRleHQuc3Vic3RyaW5nKHBhcnNlZEluZGV4ICsgcGFyc2VkVGV4dC5sZW5ndGgpO1xuICAgICAgICAgICAgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFBhcnNpbmdDb250ZXh0IHtcbiAgICB0ZXh0O1xuICAgIG9wdGlvbjtcbiAgICByZWZlcmVuY2U7XG4gICAgcmVmRGF0ZTtcbiAgICBjb25zdHJ1Y3Rvcih0ZXh0LCByZWZEYXRlLCBvcHRpb24pIHtcbiAgICAgICAgdGhpcy50ZXh0ID0gdGV4dDtcbiAgICAgICAgdGhpcy5vcHRpb24gPSBvcHRpb24gPz8ge307XG4gICAgICAgIHRoaXMucmVmZXJlbmNlID0gUmVmZXJlbmNlV2l0aFRpbWV6b25lLmZyb21JbnB1dChyZWZEYXRlLCB0aGlzLm9wdGlvbi50aW1lem9uZXMpO1xuICAgICAgICB0aGlzLnJlZkRhdGUgPSB0aGlzLnJlZmVyZW5jZS5pbnN0YW50O1xuICAgIH1cbiAgICBjcmVhdGVQYXJzaW5nQ29tcG9uZW50cyhjb21wb25lbnRzKSB7XG4gICAgICAgIGlmIChjb21wb25lbnRzIGluc3RhbmNlb2YgUGFyc2luZ0NvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnRzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgUGFyc2luZ0NvbXBvbmVudHModGhpcy5yZWZlcmVuY2UsIGNvbXBvbmVudHMpO1xuICAgIH1cbiAgICBjcmVhdGVQYXJzaW5nUmVzdWx0KGluZGV4LCB0ZXh0T3JFbmRJbmRleCwgc3RhcnRDb21wb25lbnRzLCBlbmRDb21wb25lbnRzKSB7XG4gICAgICAgIGNvbnN0IHRleHQgPSB0eXBlb2YgdGV4dE9yRW5kSW5kZXggPT09IFwic3RyaW5nXCIgPyB0ZXh0T3JFbmRJbmRleCA6IHRoaXMudGV4dC5zdWJzdHJpbmcoaW5kZXgsIHRleHRPckVuZEluZGV4KTtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBzdGFydENvbXBvbmVudHMgPyB0aGlzLmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKHN0YXJ0Q29tcG9uZW50cykgOiBudWxsO1xuICAgICAgICBjb25zdCBlbmQgPSBlbmRDb21wb25lbnRzID8gdGhpcy5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cyhlbmRDb21wb25lbnRzKSA6IG51bGw7XG4gICAgICAgIHJldHVybiBuZXcgUGFyc2luZ1Jlc3VsdCh0aGlzLnJlZmVyZW5jZSwgaW5kZXgsIHRleHQsIHN0YXJ0LCBlbmQpO1xuICAgIH1cbiAgICBkZWJ1ZyhibG9jaykge1xuICAgICAgICBpZiAodGhpcy5vcHRpb24uZGVidWcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbi5kZWJ1ZyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vcHRpb24uZGVidWcoYmxvY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXMub3B0aW9uLmRlYnVnO1xuICAgICAgICAgICAgICAgIGhhbmRsZXIuZGVidWcoYmxvY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2hyb25vLmpzLm1hcCIsImV4cG9ydCBjb25zdCBOVU1CRVIgPSB7XG4gICAgXCLpm7ZcIjogMCxcbiAgICBcIuOAh1wiOiAwLFxuICAgIFwi5LiAXCI6IDEsXG4gICAgXCLkuoxcIjogMixcbiAgICBcIuS4pFwiOiAyLFxuICAgIFwi5LiJXCI6IDMsXG4gICAgXCLlm5tcIjogNCxcbiAgICBcIuS6lFwiOiA1LFxuICAgIFwi5YWtXCI6IDYsXG4gICAgXCLkuINcIjogNyxcbiAgICBcIuWFq1wiOiA4LFxuICAgIFwi5LmdXCI6IDksXG4gICAgXCLljYFcIjogMTAsXG59O1xuZXhwb3J0IGNvbnN0IFdFRUtEQVlfT0ZGU0VUID0ge1xuICAgIFwi5aSpXCI6IDAsXG4gICAgXCLml6VcIjogMCxcbiAgICBcIuS4gFwiOiAxLFxuICAgIFwi5LqMXCI6IDIsXG4gICAgXCLkuIlcIjogMyxcbiAgICBcIuWbm1wiOiA0LFxuICAgIFwi5LqUXCI6IDUsXG4gICAgXCLlha1cIjogNixcbn07XG5leHBvcnQgZnVuY3Rpb24gemhTdHJpbmdUb051bWJlcih0ZXh0KSB7XG4gICAgbGV0IG51bWJlciA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSB0ZXh0W2ldO1xuICAgICAgICBpZiAoY2hhciA9PT0gXCLljYFcIikge1xuICAgICAgICAgICAgbnVtYmVyID0gbnVtYmVyID09PSAwID8gTlVNQkVSW2NoYXJdIDogbnVtYmVyICogTlVNQkVSW2NoYXJdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbnVtYmVyICs9IE5VTUJFUltjaGFyXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVtYmVyO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHpoU3RyaW5nVG9ZZWFyKHRleHQpIHtcbiAgICBsZXQgc3RyaW5nID0gXCJcIjtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY2hhciA9IHRleHRbaV07XG4gICAgICAgIHN0cmluZyA9IHN0cmluZyArIE5VTUJFUltjaGFyXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlSW50KHN0cmluZyk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb25zdGFudHMuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBOVU1CRVIsIHpoU3RyaW5nVG9OdW1iZXIsIHpoU3RyaW5nVG9ZZWFyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgWUVBUl9HUk9VUCA9IDE7XG5jb25zdCBNT05USF9HUk9VUCA9IDI7XG5jb25zdCBEQVlfR1JPVVAgPSAzO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zRGF0ZVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnRXhwKFwiKFwiICtcbiAgICAgICAgICAgIFwiXFxcXGR7Miw0fXxcIiArXG4gICAgICAgICAgICBcIltcIiArXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgICAgICAgICAgXCJdezR9fFwiICtcbiAgICAgICAgICAgIFwiW1wiICtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgICAgICAgICBcIl17Mn1cIiArXG4gICAgICAgICAgICBcIik/XCIgK1xuICAgICAgICAgICAgXCIoPzpcXFxccyopXCIgK1xuICAgICAgICAgICAgXCIoPzrlubQpP1wiICtcbiAgICAgICAgICAgIFwiKD86W1xcXFxzfCx877yMXSopXCIgK1xuICAgICAgICAgICAgXCIoXCIgK1xuICAgICAgICAgICAgXCJcXFxcZHsxLDJ9fFwiICtcbiAgICAgICAgICAgIFwiW1wiICtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgICAgICAgICBcIl17MSwzfVwiICtcbiAgICAgICAgICAgIFwiKVwiICtcbiAgICAgICAgICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICAgICAgICAgIFwiKD865pyIKVwiICtcbiAgICAgICAgICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICAgICAgICAgIFwiKFwiICtcbiAgICAgICAgICAgIFwiXFxcXGR7MSwyfXxcIiArXG4gICAgICAgICAgICBcIltcIiArXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgICAgICAgICAgXCJdezEsM31cIiArXG4gICAgICAgICAgICBcIik/XCIgK1xuICAgICAgICAgICAgXCIoPzpcXFxccyopXCIgK1xuICAgICAgICAgICAgXCIoPzrml6V85Y+3KT9cIik7XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgbGV0IG1vbnRoID0gcGFyc2VJbnQobWF0Y2hbTU9OVEhfR1JPVVBdKTtcbiAgICAgICAgaWYgKGlzTmFOKG1vbnRoKSlcbiAgICAgICAgICAgIG1vbnRoID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtNT05USF9HUk9VUF0pO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgbW9udGgpO1xuICAgICAgICBpZiAobWF0Y2hbREFZX0dST1VQXSkge1xuICAgICAgICAgICAgbGV0IGRheSA9IHBhcnNlSW50KG1hdGNoW0RBWV9HUk9VUF0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKGRheSkpXG4gICAgICAgICAgICAgICAgZGF5ID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtEQVlfR1JPVVBdKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgZGF5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBjb250ZXh0LnJlZkRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGxldCB5ZWFyID0gcGFyc2VJbnQobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHllYXIpKVxuICAgICAgICAgICAgICAgIHllYXIgPSB6aFN0cmluZ1RvWWVhcihtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgY29udGV4dC5yZWZEYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9WkhIYW5zRGF0ZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IGFkZER1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5pbXBvcnQgeyBOVU1CRVIsIHpoU3RyaW5nVG9OdW1iZXIgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIihcXFxcZCt8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSt85Y2KfOWHoCkoPzpcXFxccyopXCIgK1xuICAgIFwiKD865LiqKT9cIiArXG4gICAgXCIo56eSKD866ZKfKT985YiG6ZKffOWwj+aXtnzpkp985pelfOWkqXzmmJ/mnJ9856S85oucfOaciHzlubQpXCIgK1xuICAgIFwiKD86KD865LmLfOi/hyk/5ZCOfCg/OuS5iyk/5YaFKVwiLCBcImlcIik7XG5jb25zdCBOVU1CRVJfR1JPVVAgPSAxO1xuY29uc3QgVU5JVF9HUk9VUCA9IDI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBaSEhhbnNEZWFkbGluZUZvcm1hdFBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGxldCBudW1iZXIgPSBwYXJzZUludChtYXRjaFtOVU1CRVJfR1JPVVBdKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bWJlcikpIHtcbiAgICAgICAgICAgIG51bWJlciA9IHpoU3RyaW5nVG9OdW1iZXIobWF0Y2hbTlVNQkVSX0dST1VQXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzTmFOKG51bWJlcikpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0cmluZyA9IG1hdGNoW05VTUJFUl9HUk9VUF07XG4gICAgICAgICAgICBpZiAoc3RyaW5nID09PSBcIuWHoFwiKSB7XG4gICAgICAgICAgICAgICAgbnVtYmVyID0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHN0cmluZyA9PT0gXCLljYpcIikge1xuICAgICAgICAgICAgICAgIG51bWJlciA9IDAuNTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0ge307XG4gICAgICAgIGNvbnN0IHVuaXQgPSBtYXRjaFtVTklUX0dST1VQXTtcbiAgICAgICAgY29uc3QgdW5pdEFiYnIgPSB1bml0WzBdO1xuICAgICAgICBpZiAodW5pdEFiYnIubWF0Y2goL1vml6XlpKnmmJ/npLzmnIjlubRdLykpIHtcbiAgICAgICAgICAgIGlmICh1bml0QWJiciA9PSBcIuaXpVwiIHx8IHVuaXRBYmJyID09IFwi5aSpXCIpIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbi5kYXkgPSBudW1iZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh1bml0QWJiciA9PSBcIuaYn1wiIHx8IHVuaXRBYmJyID09IFwi56S8XCIpIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbi53ZWVrID0gbnVtYmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodW5pdEFiYnIgPT0gXCLmnIhcIikge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uLm1vbnRoID0gbnVtYmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodW5pdEFiYnIgPT0gXCLlubRcIikge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uLnllYXIgPSBudW1iZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBkYXRlID0gYWRkRHVyYXRpb24oY29udGV4dC5yZWZEYXRlLCBkdXJhdGlvbik7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIGlmICh1bml0QWJiciA9PSBcIuenklwiKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi5zZWNvbmQgPSBudW1iZXI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodW5pdEFiYnIgPT0gXCLliIZcIikge1xuICAgICAgICAgICAgZHVyYXRpb24ubWludXRlID0gbnVtYmVyO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaXRBYmJyID09IFwi5bCPXCIgfHwgdW5pdEFiYnIgPT0gXCLpkp9cIikge1xuICAgICAgICAgICAgZHVyYXRpb24uaG91ciA9IG51bWJlcjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkYXRlID0gYWRkRHVyYXRpb24oY29udGV4dC5yZWZEYXRlLCBkdXJhdGlvbik7XG4gICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJob3VyXCIsIGRhdGUuZ2V0SG91cnMoKSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtaW51dGVcIiwgZGF0ZS5nZXRNaW51dGVzKCkpO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwic2Vjb25kXCIsIGRhdGUuZ2V0U2Vjb25kcygpKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNEZWFkbGluZUZvcm1hdFBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IFdFRUtEQVlfT0ZGU0VUIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzxwcmVmaXg+5LiKfOS4i3zov5kpKD865LiqKT8oPzrmmJ/mnJ9856S85oucfOWRqCkoPzx3ZWVrZGF5PlwiICsgT2JqZWN0LmtleXMoV0VFS0RBWV9PRkZTRVQpLmpvaW4oXCJ8XCIpICsgXCIpXCIpO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zUmVsYXRpb25XZWVrZGF5UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgY29uc3QgZGF5T2ZXZWVrID0gbWF0Y2guZ3JvdXBzLndlZWtkYXk7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IFdFRUtEQVlfT0ZGU0VUW2RheU9mV2Vla107XG4gICAgICAgIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICBsZXQgbW9kaWZpZXIgPSBudWxsO1xuICAgICAgICBjb25zdCBwcmVmaXggPSBtYXRjaC5ncm91cHMucHJlZml4O1xuICAgICAgICBpZiAocHJlZml4ID09IFwi5LiKXCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJsYXN0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocHJlZml4ID09IFwi5LiLXCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJuZXh0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocHJlZml4ID09IFwi6L+ZXCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJ0aGlzXCI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGNvbnRleHQucmVmRGF0ZS5nZXRUaW1lKCkpO1xuICAgICAgICBsZXQgc3RhcnRNb21lbnRGaXhlZCA9IGZhbHNlO1xuICAgICAgICBjb25zdCByZWZPZmZzZXQgPSBkYXRlLmdldERheSgpO1xuICAgICAgICBpZiAobW9kaWZpZXIgPT0gXCJsYXN0XCIgfHwgbW9kaWZpZXIgPT0gXCJwYXN0XCIpIHtcbiAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIChvZmZzZXQgLSA3IC0gcmVmT2Zmc2V0KSk7XG4gICAgICAgICAgICBzdGFydE1vbWVudEZpeGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtb2RpZmllciA9PSBcIm5leHRcIikge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgKG9mZnNldCArIDcgLSByZWZPZmZzZXQpKTtcbiAgICAgICAgICAgIHN0YXJ0TW9tZW50Rml4ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1vZGlmaWVyID09IFwidGhpc1wiKSB7XG4gICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyAob2Zmc2V0IC0gcmVmT2Zmc2V0KSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsZXQgZGlmZiA9IG9mZnNldCAtIHJlZk9mZnNldDtcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhkaWZmIC0gNykgPCBNYXRoLmFicyhkaWZmKSkge1xuICAgICAgICAgICAgICAgIGRpZmYgLT0gNztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhkaWZmICsgNykgPCBNYXRoLmFicyhkaWZmKSkge1xuICAgICAgICAgICAgICAgIGRpZmYgKz0gNztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIGRpZmYpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ3ZWVrZGF5XCIsIG9mZnNldCk7XG4gICAgICAgIGlmIChzdGFydE1vbWVudEZpeGVkKSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNSZWxhdGlvbldlZWtkYXlQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBOVU1CRVIsIHpoU3RyaW5nVG9OdW1iZXIgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5jb25zdCBGSVJTVF9SRUdfUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzrku4586IeqKT9cIiArXG4gICAgXCIoPzpcIiArXG4gICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSjml6l85pydfOaZmil8XCIgK1xuICAgIFwiKOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKXxcIiArXG4gICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSg/OuaXpXzlpKkpXCIgK1xuICAgIFwiKD86W1xcXFxzLO+8jF0qKVwiICtcbiAgICBcIig/OijkuIooPzrljYgpfOaXqSg/OuS4iil85LiLKD865Y2IKXzmmZooPzrkuIopfOWknCg/OuaZmik/fOS4rSg/OuWNiCl85YeMKD865pmoKSkpP1wiICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD86W1xcXFxzLO+8jF0qKVwiICtcbiAgICBcIig/OihcXFxcZCt8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspKD86XFxcXHMqKSg/OueCuXzml7Z8OnzvvJopXCIgK1xuICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICBcIihcXFxcZCt85Y2KfOato3zmlbR8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspPyg/OlxcXFxzKikoPzrliIZ8OnzvvJopP1wiICtcbiAgICBcIig/OlxcXFxzKilcIiArXG4gICAgXCIoXFxcXGQrfFtcIiArXG4gICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICBcIl0rKT8oPzpcXFxccyopKD8656eSKT8pXCIgK1xuICAgIFwiKD86XFxcXHMqKEEuTS58UC5NLnxBTT98UE0/KSk/XCIsIFwiaVwiKTtcbmNvbnN0IFNFQ09ORF9SRUdfUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzpeXFxcXHMqKD865YiwfOiHs3xcXFxcLXxcXFxc4oCTfFxcXFx+fFxcXFzjgJwpXFxcXHMqKVwiICtcbiAgICBcIig/OlwiICtcbiAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKOaXqXzmnJ185pmaKXxcIiArXG4gICAgXCIo5LiKKD865Y2IKXzml6koPzrkuIopfOS4iyg/OuWNiCl85pmaKD865LiKKXzlpJwoPzrmmZopP3zkuK0oPzrljYgpfOWHjCg/OuaZqCkpfFwiICtcbiAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKD865pelfOWkqSlcIiArXG4gICAgXCIoPzpbXFxcXHMs77yMXSopXCIgK1xuICAgIFwiKD86KOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKSk/XCIgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPzpbXFxcXHMs77yMXSopXCIgK1xuICAgIFwiKD86KFxcXFxkK3xbXCIgK1xuICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgXCJdKykoPzpcXFxccyopKD8654K5fOaXtnw6fO+8milcIiArXG4gICAgXCIoPzpcXFxccyopXCIgK1xuICAgIFwiKFxcXFxkK3zljYp85q2jfOaVtHxbXCIgK1xuICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgXCJdKyk/KD86XFxcXHMqKSg/OuWIhnw6fO+8mik/XCIgK1xuICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICBcIihcXFxcZCt8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspPyg/OlxcXFxzKikoPzrnp5IpPylcIiArXG4gICAgXCIoPzpcXFxccyooQS5NLnxQLk0ufEFNP3xQTT8pKT9cIiwgXCJpXCIpO1xuY29uc3QgREFZX0dST1VQXzEgPSAxO1xuY29uc3QgWkhfQU1fUE1fSE9VUl9HUk9VUF8xID0gMjtcbmNvbnN0IFpIX0FNX1BNX0hPVVJfR1JPVVBfMiA9IDM7XG5jb25zdCBEQVlfR1JPVVBfMyA9IDQ7XG5jb25zdCBaSF9BTV9QTV9IT1VSX0dST1VQXzMgPSA1O1xuY29uc3QgSE9VUl9HUk9VUCA9IDY7XG5jb25zdCBNSU5VVEVfR1JPVVAgPSA3O1xuY29uc3QgU0VDT05EX0dST1VQID0gODtcbmNvbnN0IEFNX1BNX0hPVVJfR1JPVVAgPSA5O1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zVGltZUV4cHJlc3Npb25QYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgcGF0dGVybkxlZnRCb3VuZGFyeSgpIHtcbiAgICAgICAgcmV0dXJuIFwiKClcIjtcbiAgICB9XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gRklSU1RfUkVHX1BBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBpZiAobWF0Y2guaW5kZXggPiAwICYmIGNvbnRleHQudGV4dFttYXRjaC5pbmRleCAtIDFdLm1hdGNoKC9cXHcvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGNvbnN0IHN0YXJ0TW9tZW50ID0gbmV3IERhdGUoY29udGV4dC5yZWZlcmVuY2UuaW5zdGFudC5nZXRUaW1lKCkpO1xuICAgICAgICBpZiAobWF0Y2hbREFZX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkxID0gbWF0Y2hbREFZX0dST1VQXzFdO1xuICAgICAgICAgICAgaWYgKGRheTEgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGlmIChjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50LmdldEhvdXJzKCkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuaYqFwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgLSAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLliY1cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSAtIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWQjlwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgKyAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLlpKflkI5cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIHN0YXJ0TW9tZW50LmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgc3RhcnRNb21lbnQuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgc3RhcnRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbREFZX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkzID0gbWF0Y2hbREFZX0dST1VQXzNdO1xuICAgICAgICAgICAgaWYgKGRheTMgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5pioXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWJjVwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgLSAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKfliY1cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpIC0gMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSArIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWkp+WQjlwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgKyAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgc3RhcnRNb21lbnQuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBzdGFydE1vbWVudC5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCBzdGFydE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBzdGFydE1vbWVudC5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgc3RhcnRNb21lbnQuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCBzdGFydE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaG91ciA9IDA7XG4gICAgICAgIGxldCBtaW51dGUgPSAwO1xuICAgICAgICBsZXQgbWVyaWRpZW0gPSAtMTtcbiAgICAgICAgaWYgKG1hdGNoW1NFQ09ORF9HUk9VUF0pIHtcbiAgICAgICAgICAgIGxldCBzZWNvbmQgPSBwYXJzZUludChtYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChpc05hTihzZWNvbmQpKSB7XG4gICAgICAgICAgICAgICAgc2Vjb25kID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzZWNvbmQgPj0gNjApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwic2Vjb25kXCIsIHNlY29uZCk7XG4gICAgICAgIH1cbiAgICAgICAgaG91ciA9IHBhcnNlSW50KG1hdGNoW0hPVVJfR1JPVVBdKTtcbiAgICAgICAgaWYgKGlzTmFOKGhvdXIpKSB7XG4gICAgICAgICAgICBob3VyID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtIT1VSX0dST1VQXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW01JTlVURV9HUk9VUF0pIHtcbiAgICAgICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdID09IFwi5Y2KXCIpIHtcbiAgICAgICAgICAgICAgICBtaW51dGUgPSAzMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoW01JTlVURV9HUk9VUF0gPT0gXCLmraNcIiB8fCBtYXRjaFtNSU5VVEVfR1JPVVBdID09IFwi5pW0XCIpIHtcbiAgICAgICAgICAgICAgICBtaW51dGUgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gcGFyc2VJbnQobWF0Y2hbTUlOVVRFX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgaWYgKGlzTmFOKG1pbnV0ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWludXRlID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtNSU5VVEVfR1JPVVBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaG91ciA+IDEwMCkge1xuICAgICAgICAgICAgbWludXRlID0gaG91ciAlIDEwMDtcbiAgICAgICAgICAgIGhvdXIgPSBNYXRoLmZsb29yKGhvdXIgLyAxMDApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtaW51dGUgPj0gNjApIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID4gMjQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID49IDEyKSB7XG4gICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdKSB7XG4gICAgICAgICAgICBpZiAoaG91ciA+IDEyKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3QgYW1wbSA9IG1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdWzBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBpZiAoYW1wbSA9PSBcImFcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYW1wbSA9PSBcInBcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCB6aEFNUE1TdHJpbmcxID0gbWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8xXTtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTTEgPSB6aEFNUE1TdHJpbmcxWzBdO1xuICAgICAgICAgICAgaWYgKHpoQU1QTTEgPT0gXCLml6lcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0xID09IFwi5pmaXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8yXSkge1xuICAgICAgICAgICAgY29uc3QgemhBTVBNU3RyaW5nMiA9IG1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMl07XG4gICAgICAgICAgICBjb25zdCB6aEFNUE0yID0gemhBTVBNU3RyaW5nMlswXTtcbiAgICAgICAgICAgIGlmICh6aEFNUE0yID09IFwi5LiKXCIgfHwgemhBTVBNMiA9PSBcIuaXqVwiIHx8IHpoQU1QTTIgPT0gXCLlh4xcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0yID09IFwi5LiLXCIgfHwgemhBTVBNMiA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTVN0cmluZzMgPSBtYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzNdO1xuICAgICAgICAgICAgY29uc3QgemhBTVBNMyA9IHpoQU1QTVN0cmluZzNbMF07XG4gICAgICAgICAgICBpZiAoemhBTVBNMyA9PSBcIuS4ilwiIHx8IHpoQU1QTTMgPT0gXCLml6lcIiB8fCB6aEFNUE0zID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMyA9PSBcIuS4i1wiIHx8IHpoQU1QTTMgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCBob3VyKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1pbnV0ZVwiLCBtaW51dGUpO1xuICAgICAgICBpZiAobWVyaWRpZW0gPj0gMCkge1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1lcmlkaWVtXCIsIG1lcmlkaWVtKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChob3VyIDwgMTIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNlY29uZE1hdGNoID0gU0VDT05EX1JFR19QQVRURVJOLmV4ZWMoY29udGV4dC50ZXh0LnN1YnN0cmluZyhyZXN1bHQuaW5kZXggKyByZXN1bHQudGV4dC5sZW5ndGgpKTtcbiAgICAgICAgaWYgKCFzZWNvbmRNYXRjaCkge1xuICAgICAgICAgICAgaWYgKHJlc3VsdC50ZXh0Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgZW5kTW9tZW50ID0gbmV3IERhdGUoc3RhcnRNb21lbnQuZ2V0VGltZSgpKTtcbiAgICAgICAgaWYgKHNlY29uZE1hdGNoW0RBWV9HUk9VUF8xXSB8fCBzZWNvbmRNYXRjaFtEQVlfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGVuZE1vbWVudCA9IG5ldyBEYXRlKGNvbnRleHQucmVmZXJlbmNlLmluc3RhbnQuZ2V0VGltZSgpKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuZW5kID0gY29udGV4dC5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cygpO1xuICAgICAgICBpZiAoc2Vjb25kTWF0Y2hbREFZX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkxID0gc2Vjb25kTWF0Y2hbREFZX0dST1VQXzFdO1xuICAgICAgICAgICAgaWYgKGRheTEgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGlmIChjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50LmdldEhvdXJzKCkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5pioXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImRheVwiLCBlbmRNb21lbnQuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwibW9udGhcIiwgZW5kTW9tZW50LmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwieWVhclwiLCBlbmRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2Vjb25kTWF0Y2hbREFZX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkzID0gc2Vjb25kTWF0Y2hbREFZX0dST1VQXzNdO1xuICAgICAgICAgICAgaWYgKGRheTMgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLmmKhcIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgLSAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLliY1cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgLSAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKfliY1cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgLSAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlkI5cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKflkI5cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwiZGF5XCIsIGVuZE1vbWVudC5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJtb250aFwiLCBlbmRNb21lbnQuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJ5ZWFyXCIsIGVuZE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuaW1wbHkoXCJkYXlcIiwgZW5kTW9tZW50LmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwibW9udGhcIiwgZW5kTW9tZW50LmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuaW1wbHkoXCJ5ZWFyXCIsIGVuZE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBob3VyID0gMDtcbiAgICAgICAgbWludXRlID0gMDtcbiAgICAgICAgbWVyaWRpZW0gPSAtMTtcbiAgICAgICAgaWYgKHNlY29uZE1hdGNoW1NFQ09ORF9HUk9VUF0pIHtcbiAgICAgICAgICAgIGxldCBzZWNvbmQgPSBwYXJzZUludChzZWNvbmRNYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChpc05hTihzZWNvbmQpKSB7XG4gICAgICAgICAgICAgICAgc2Vjb25kID0gemhTdHJpbmdUb051bWJlcihzZWNvbmRNYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzZWNvbmQgPj0gNjApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcInNlY29uZFwiLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIGhvdXIgPSBwYXJzZUludChzZWNvbmRNYXRjaFtIT1VSX0dST1VQXSk7XG4gICAgICAgIGlmIChpc05hTihob3VyKSkge1xuICAgICAgICAgICAgaG91ciA9IHpoU3RyaW5nVG9OdW1iZXIoc2Vjb25kTWF0Y2hbSE9VUl9HUk9VUF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZWNvbmRNYXRjaFtNSU5VVEVfR1JPVVBdKSB7XG4gICAgICAgICAgICBpZiAoc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBcIuWNilwiKSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gMzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzZWNvbmRNYXRjaFtNSU5VVEVfR1JPVVBdID09IFwi5q2jXCIgfHwgc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBcIuaVtFwiKSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIG1pbnV0ZSA9IHBhcnNlSW50KHNlY29uZE1hdGNoW01JTlVURV9HUk9VUF0pO1xuICAgICAgICAgICAgICAgIGlmIChpc05hTihtaW51dGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbnV0ZSA9IHpoU3RyaW5nVG9OdW1iZXIoc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGhvdXIgPiAxMDApIHtcbiAgICAgICAgICAgIG1pbnV0ZSA9IGhvdXIgJSAxMDA7XG4gICAgICAgICAgICBob3VyID0gTWF0aC5mbG9vcihob3VyIC8gMTAwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWludXRlID49IDYwKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG91ciA+IDI0KSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG91ciA+PSAxMikge1xuICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZWNvbmRNYXRjaFtBTV9QTV9IT1VSX0dST1VQXSkge1xuICAgICAgICAgICAgaWYgKGhvdXIgPiAxMilcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGFtcG0gPSBzZWNvbmRNYXRjaFtBTV9QTV9IT1VSX0dST1VQXVswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJhXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJwXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSkge1xuICAgICAgICAgICAgICAgIGlmIChtZXJpZGllbSA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDApO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgPT0gMTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJob3VyXCIsIDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5nZXQoXCJob3VyXCIpICE9IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzZWNvbmRNYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCB6aEFNUE1TdHJpbmcxID0gc2Vjb25kTWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8xXTtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTTEgPSB6aEFNUE1TdHJpbmcxWzBdO1xuICAgICAgICAgICAgaWYgKHpoQU1QTTEgPT0gXCLml6lcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0xID09IFwi5pmaXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2Vjb25kTWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8yXSkge1xuICAgICAgICAgICAgY29uc3QgemhBTVBNU3RyaW5nMiA9IHNlY29uZE1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMl07XG4gICAgICAgICAgICBjb25zdCB6aEFNUE0yID0gemhBTVBNU3RyaW5nMlswXTtcbiAgICAgICAgICAgIGlmICh6aEFNUE0yID09IFwi5LiKXCIgfHwgemhBTVBNMiA9PSBcIuaXqVwiIHx8IHpoQU1QTTIgPT0gXCLlh4xcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0yID09IFwi5LiLXCIgfHwgemhBTVBNMiA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNlY29uZE1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTVN0cmluZzMgPSBzZWNvbmRNYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzNdO1xuICAgICAgICAgICAgY29uc3QgemhBTVBNMyA9IHpoQU1QTVN0cmluZzNbMF07XG4gICAgICAgICAgICBpZiAoemhBTVBNMyA9PSBcIuS4ilwiIHx8IHpoQU1QTTMgPT0gXCLml6lcIiB8fCB6aEFNUE0zID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMyA9PSBcIuS4i1wiIHx8IHpoQU1QTTMgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQudGV4dCA9IHJlc3VsdC50ZXh0ICsgc2Vjb25kTWF0Y2hbMF07XG4gICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwiaG91clwiLCBob3VyKTtcbiAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJtaW51dGVcIiwgbWludXRlKTtcbiAgICAgICAgaWYgKG1lcmlkaWVtID49IDApIHtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwibWVyaWRpZW1cIiwgbWVyaWRpZW0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc3RhcnRBdFBNID0gcmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcIm1lcmlkaWVtXCIpICYmIHJlc3VsdC5zdGFydC5nZXQoXCJtZXJpZGllbVwiKSA9PSAxO1xuICAgICAgICAgICAgaWYgKHN0YXJ0QXRQTSAmJiByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSA+IGhvdXIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwibWVyaWRpZW1cIiwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChob3VyID4gMTIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC5lbmQuZGF0ZSgpLmdldFRpbWUoKSA8IHJlc3VsdC5zdGFydC5kYXRlKCkuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwiZGF5XCIsIHJlc3VsdC5lbmQuZ2V0KFwiZGF5XCIpICsgMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNUaW1lRXhwcmVzc2lvblBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IFdFRUtEQVlfT0ZGU0VUIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzrmmJ/mnJ9856S85oucfOWRqCkoPzx3ZWVrZGF5PlwiICsgT2JqZWN0LmtleXMoV0VFS0RBWV9PRkZTRVQpLmpvaW4oXCJ8XCIpICsgXCIpXCIpO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zV2Vla2RheVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGNvbnN0IGRheU9mV2VlayA9IG1hdGNoLmdyb3Vwcy53ZWVrZGF5O1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBXRUVLREFZX09GRlNFVFtkYXlPZldlZWtdO1xuICAgICAgICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGNvbnRleHQucmVmRGF0ZS5nZXRUaW1lKCkpO1xuICAgICAgICBjb25zdCBzdGFydE1vbWVudEZpeGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHJlZk9mZnNldCA9IGRhdGUuZ2V0RGF5KCk7XG4gICAgICAgIGxldCBkaWZmID0gb2Zmc2V0IC0gcmVmT2Zmc2V0O1xuICAgICAgICBpZiAoTWF0aC5hYnMoZGlmZiAtIDcpIDwgTWF0aC5hYnMoZGlmZikpIHtcbiAgICAgICAgICAgIGRpZmYgLT0gNztcbiAgICAgICAgfVxuICAgICAgICBpZiAoTWF0aC5hYnMoZGlmZiArIDcpIDwgTWF0aC5hYnMoZGlmZikpIHtcbiAgICAgICAgICAgIGRpZmYgKz0gNztcbiAgICAgICAgfVxuICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyBkaWZmKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIndlZWtkYXlcIiwgb2Zmc2V0KTtcbiAgICAgICAgaWYgKHN0YXJ0TW9tZW50Rml4ZWQpIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVpISGFuc1dlZWtkYXlQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBOT1dfR1JPVVAgPSAxO1xuY29uc3QgREFZX0dST1VQXzEgPSAyO1xuY29uc3QgVElNRV9HUk9VUF8xID0gMztcbmNvbnN0IFRJTUVfR1JPVVBfMiA9IDQ7XG5jb25zdCBEQVlfR1JPVVBfMyA9IDU7XG5jb25zdCBUSU1FX0dST1VQXzMgPSA2O1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oY29udGV4dCkge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ0V4cChcIijnjrDlnKh856uLKD865Yi7fOWNsyl85Y2z5Yi7KXxcIiArXG4gICAgICAgICAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKOaXqXzmmZopfFwiICtcbiAgICAgICAgICAgIFwiKOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKXxcIiArXG4gICAgICAgICAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKD865pelfOWkqSlcIiArXG4gICAgICAgICAgICBcIig/OltcXFxcc3wsfO+8jF0qKVwiICtcbiAgICAgICAgICAgIFwiKD86KOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKSk/XCIsIFwiaVwiKTtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChpbmRleCwgbWF0Y2hbMF0pO1xuICAgICAgICBjb25zdCByZWZEYXRlID0gY29udGV4dC5yZWZEYXRlO1xuICAgICAgICBsZXQgZGF0ZSA9IG5ldyBEYXRlKHJlZkRhdGUuZ2V0VGltZSgpKTtcbiAgICAgICAgaWYgKG1hdGNoW05PV19HUk9VUF0pIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgcmVmRGF0ZS5nZXRIb3VycygpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1pbnV0ZVwiLCByZWZEYXRlLmdldE1pbnV0ZXMoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJzZWNvbmRcIiwgcmVmRGF0ZS5nZXRTZWNvbmRzKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgcmVmRGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbREFZX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkxID0gbWF0Y2hbREFZX0dST1VQXzFdO1xuICAgICAgICAgICAgY29uc3QgdGltZTEgPSBtYXRjaFtUSU1FX0dST1VQXzFdO1xuICAgICAgICAgICAgaWYgKGRheTEgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGlmIChyZWZEYXRlLmdldEhvdXJzKCkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLmmKhcIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWJjVwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLlkI5cIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWkp+WQjlwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGltZTEgPT0gXCLml6lcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgNik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aW1lMSA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAyMik7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbVElNRV9HUk9VUF8yXSkge1xuICAgICAgICAgICAgY29uc3QgdGltZVN0cmluZzIgPSBtYXRjaFtUSU1FX0dST1VQXzJdO1xuICAgICAgICAgICAgY29uc3QgdGltZTIgPSB0aW1lU3RyaW5nMlswXTtcbiAgICAgICAgICAgIGlmICh0aW1lMiA9PSBcIuaXqVwiIHx8IHRpbWUyID09IFwi5LiKXCIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTIgPT0gXCLkuItcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMTUpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTIgPT0gXCLkuK1cIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMTIpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTIgPT0gXCLlpJxcIiB8fCB0aW1lMiA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAyMik7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aW1lMiA9PSBcIuWHjFwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtYXRjaFtEQVlfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGNvbnN0IGRheTMgPSBtYXRjaFtEQVlfR1JPVVBfM107XG4gICAgICAgICAgICBpZiAoZGF5MyA9PSBcIuaYjlwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlZkRhdGUuZ2V0SG91cnMoKSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuaYqFwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKfliY1cIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSAtIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWQjlwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5aSn5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHRpbWVTdHJpbmczID0gbWF0Y2hbVElNRV9HUk9VUF8zXTtcbiAgICAgICAgICAgIGlmICh0aW1lU3RyaW5nMykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpbWUzID0gdGltZVN0cmluZzNbMF07XG4gICAgICAgICAgICAgICAgaWYgKHRpbWUzID09IFwi5pepXCIgfHwgdGltZTMgPT0gXCLkuIpcIikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aW1lMyA9PSBcIuS4i1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMTUpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGltZTMgPT0gXCLkuK1cIikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDEyKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUzID09IFwi5aScXCIgfHwgdGltZTMgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDIyKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUzID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNDYXN1YWxEYXRlUGFyc2VyLmpzLm1hcCIsImltcG9ydCBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3JlZmluZXJzL0Fic3RyYWN0TWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBaSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIgZXh0ZW5kcyBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciB7XG4gICAgcGF0dGVybkJldHdlZW4oKSB7XG4gICAgICAgIHJldHVybiAvXlxccyoo6IezfOWIsHwtfH58772efO+8jXzjg7wpXFxzKiQvaTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIuanMubWFwIiwiaW1wb3J0IEFic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIgZnJvbSBcIi4uLy4uLy4uLy4uL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBaSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lciBleHRlbmRzIEFic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIge1xuICAgIHBhdHRlcm5CZXR3ZWVuKCkge1xuICAgICAgICByZXR1cm4gL15cXHMqJC9pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVpISGFuc01lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCBFeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyIGZyb20gXCIuLi8uLi8uLi9jb21tb24vcmVmaW5lcnMvRXh0cmFjdFRpbWV6b25lT2Zmc2V0UmVmaW5lci5qc1wiO1xuaW1wb3J0IHsgaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24gfSBmcm9tIFwiLi4vLi4vLi4vY29uZmlndXJhdGlvbnMuanNcIjtcbmltcG9ydCB7IENocm9ubyB9IGZyb20gXCIuLi8uLi8uLi9jaHJvbm8uanNcIjtcbmltcG9ydCB7IFBhcnNpbmdSZXN1bHQsIFBhcnNpbmdDb21wb25lbnRzLCBSZWZlcmVuY2VXaXRoVGltZXpvbmUgfSBmcm9tIFwiLi4vLi4vLi4vcmVzdWx0cy5qc1wiO1xuaW1wb3J0IHsgTWVyaWRpZW0sIFdlZWtkYXkgfSBmcm9tIFwiLi4vLi4vLi4vdHlwZXMuanNcIjtcbmltcG9ydCBaSEhhbnNDYXN1YWxEYXRlUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc0RhdGVQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9aSEhhbnNEYXRlUGFyc2VyLmpzXCI7XG5pbXBvcnQgWkhIYW5zRGVhZGxpbmVGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9aSEhhbnNEZWFkbGluZUZvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL1pISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc1RpbWVFeHByZXNzaW9uUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zVGltZUV4cHJlc3Npb25QYXJzZXIuanNcIjtcbmltcG9ydCBaSEhhbnNXZWVrZGF5UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zV2Vla2RheVBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc01lcmdlRGF0ZVJhbmdlUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9aSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIuanNcIjtcbmltcG9ydCBaSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9aSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lci5qc1wiO1xuZXhwb3J0IHsgQ2hyb25vLCBQYXJzaW5nUmVzdWx0LCBQYXJzaW5nQ29tcG9uZW50cywgUmVmZXJlbmNlV2l0aFRpbWV6b25lIH07XG5leHBvcnQgeyBNZXJpZGllbSwgV2Vla2RheSB9O1xuZXhwb3J0IGNvbnN0IGhhbnMgPSBuZXcgQ2hyb25vKGNyZWF0ZUNhc3VhbENvbmZpZ3VyYXRpb24oKSk7XG5leHBvcnQgY29uc3QgY2FzdWFsID0gbmV3IENocm9ubyhjcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCkpO1xuZXhwb3J0IGNvbnN0IHN0cmljdCA9IG5ldyBDaHJvbm8oY3JlYXRlQ29uZmlndXJhdGlvbigpKTtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZSh0ZXh0LCByZWYsIG9wdGlvbikge1xuICAgIHJldHVybiBjYXN1YWwucGFyc2UodGV4dCwgcmVmLCBvcHRpb24pO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRGF0ZSh0ZXh0LCByZWYsIG9wdGlvbikge1xuICAgIHJldHVybiBjYXN1YWwucGFyc2VEYXRlKHRleHQsIHJlZiwgb3B0aW9uKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCkge1xuICAgIGNvbnN0IG9wdGlvbiA9IGNyZWF0ZUNvbmZpZ3VyYXRpb24oKTtcbiAgICBvcHRpb24ucGFyc2Vycy51bnNoaWZ0KG5ldyBaSEhhbnNDYXN1YWxEYXRlUGFyc2VyKCkpO1xuICAgIHJldHVybiBvcHRpb247XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29uZmlndXJhdGlvbigpIHtcbiAgICBjb25zdCBjb25maWd1cmF0aW9uID0gaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24oe1xuICAgICAgICBwYXJzZXJzOiBbXG4gICAgICAgICAgICBuZXcgWkhIYW5zRGF0ZVBhcnNlcigpLFxuICAgICAgICAgICAgbmV3IFpISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlcigpLFxuICAgICAgICAgICAgbmV3IFpISGFuc1dlZWtkYXlQYXJzZXIoKSxcbiAgICAgICAgICAgIG5ldyBaSEhhbnNUaW1lRXhwcmVzc2lvblBhcnNlcigpLFxuICAgICAgICAgICAgbmV3IFpISGFuc0RlYWRsaW5lRm9ybWF0UGFyc2VyKCksXG4gICAgICAgIF0sXG4gICAgICAgIHJlZmluZXJzOiBbbmV3IFpISGFuc01lcmdlRGF0ZVJhbmdlUmVmaW5lcigpLCBuZXcgWkhIYW5zTWVyZ2VEYXRlVGltZVJlZmluZXIoKV0sXG4gICAgfSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycyA9IGNvbmZpZ3VyYXRpb24ucmVmaW5lcnMuZmlsdGVyKChyZWZpbmVyKSA9PiAhKHJlZmluZXIgaW5zdGFuY2VvZiBFeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyKSk7XG4gICAgcmV0dXJuIGNvbmZpZ3VyYXRpb247XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgKiBhcyBjaHJvbm8gZnJvbSBcImNocm9uby1ub2RlXCI7XG5pbXBvcnQgeyBDaHJvbm8sIFBhcnNlciB9IGZyb20gXCJjaHJvbm8tbm9kZVwiO1xuaW1wb3J0IHsgbW9tZW50IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbmltcG9ydCB7IERheU9mV2VlayB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQge1xuICBaSF9SRUxBVElWRV9EQVlTLFxuICBaSF9TUEVDSUFMX0RBVEVTLFxuICBaSF9PUkRJTkFMUyxcbiAgWkhfVEhJUyxcbiAgWkhfTkVYVCxcbiAgWkhfV0VFS19XT1JEUyxcbiAgWkhfTU9OVEhfV09SRFMsXG4gIFpIX1lFQVJfV09SRFMsXG4gIFpIX1BPU0lUSU9OLFxufSBmcm9tIFwiLi9sb2NhbGVcIjtcbmltcG9ydCB7IGdldExhc3REYXlPZk1vbnRoLCBnZXRMb2NhbGVXZWVrU3RhcnQsIGdldFdlZWtOdW1iZXIgfSBmcm9tIFwiLi91dGlsc1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE5MRFJlc3VsdCB7XG4gIGZvcm1hdHRlZFN0cmluZzogc3RyaW5nO1xuICBkYXRlOiBEYXRlO1xuICBtb21lbnQ6IG1vbWVudC5Nb21lbnQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVpoQ2hyb25vKCk6IENocm9ubyB7XG4gIGNvbnN0IHpoQ29uZmlnID0gY2hyb25vLnpoLmhhbnMuY3JlYXRlQ2FzdWFsQ29uZmlndXJhdGlvbigpO1xuICBjb25zdCB6aENocm9ubyA9IG5ldyBDaHJvbm8oemhDb25maWcpO1xuXG4gIC8vIEN1c3RvbSBQYXJzZXIgMTog54m55q6K5YWs5Y6G5pel5pyf77yI5YWD5pem44CB5Zu95bqG44CB5Zyj6K+e562J77yJXG4gIGNvbnN0IHNwZWNpYWxLZXlzID0gT2JqZWN0LmtleXMoWkhfU1BFQ0lBTF9EQVRFUykuc29ydChcbiAgICAoYTogc3RyaW5nLCBiOiBzdHJpbmcpID0+IGIubGVuZ3RoIC0gYS5sZW5ndGhcbiAgKTtcbiAgaWYgKHNwZWNpYWxLZXlzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBzcGVjaWFsUGF0dGVybiA9IHNwZWNpYWxLZXlzLmpvaW4oXCJ8XCIpO1xuICAgIHpoQ2hyb25vLnBhcnNlcnMucHVzaCh7XG4gICAgICBwYXR0ZXJuOiAoKSA9PiBuZXcgUmVnRXhwKHNwZWNpYWxQYXR0ZXJuKSxcbiAgICAgIGV4dHJhY3Q6IChfY29udGV4dDogYW55LCBtYXRjaDogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBaSF9TUEVDSUFMX0RBVEVTW21hdGNoWzBdIGFzIHN0cmluZ107XG4gICAgICAgIGlmIChkYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIHsgZGF5OiBkYXRlLmRheSwgbW9udGg6IGRhdGUubW9udGggfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgfSBhcyBQYXJzZXIpO1xuICB9XG5cbiAgLy8gQ3VzdG9tIFBhcnNlciAyOiDkuK3mlofluo/mlbDor43jgIznrKzkuIDjgI3jgIznrKzkuozjgI0uLi4g44CM56ys5LiJ5Y2B5LiA44CNXG4gIGNvbnN0IG9yZGluYWxLZXlzID0gT2JqZWN0LmtleXMoWkhfT1JESU5BTFMpLnNvcnQoXG4gICAgKGE6IHN0cmluZywgYjogc3RyaW5nKSA9PiBiLmxlbmd0aCAtIGEubGVuZ3RoXG4gICk7XG4gIGNvbnN0IG9yZGluYWxQYXR0ZXJuID0gb3JkaW5hbEtleXMuam9pbihcInxcIik7XG4gIHpoQ2hyb25vLnBhcnNlcnMucHVzaCh7XG4gICAgcGF0dGVybjogKCkgPT4gbmV3IFJlZ0V4cChg56ysKCR7b3JkaW5hbFBhdHRlcm59KWApLFxuICAgIGV4dHJhY3Q6IChfY29udGV4dDogYW55LCBtYXRjaDogYW55KSA9PiB7XG4gICAgICBjb25zdCBudW0gPSBaSF9PUkRJTkFMU1ttYXRjaFsxXSBhcyBzdHJpbmddO1xuICAgICAgaWYgKG51bSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB7IGRheTogbnVtLCBtb250aDogbW9tZW50KCkubW9udGgoKSArIDEgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gIH0gYXMgUGFyc2VyKTtcblxuICAvLyBDdXN0b20gUGFyc2VyIDM6IOebuOWvueaXpe+8iOWQjuWkqeOAgeWkp+WQjuWkqeOAgeWJjeWkqeOAgeWkp+WJjeWkqe+8iVxuICAvLyBjaHJvbm8gemguaGFucyDlj6ropobnm5bku4rlpKkv5piO5aSpL+aYqOWkqVxuICBjb25zdCByZWxhdGl2ZUVudHJpZXM6IFtzdHJpbmcsIG51bWJlcl1bXSA9IE9iamVjdC5lbnRyaWVzKFpIX1JFTEFUSVZFX0RBWVMpXG4gICAgLmZpbHRlcihcbiAgICAgIChbLCBvZmZzZXRdOiBbc3RyaW5nLCBudW1iZXJdKSA9PlxuICAgICAgICBvZmZzZXQgIT09IDAgJiYgb2Zmc2V0ICE9PSAxICYmIG9mZnNldCAhPT0gLTFcbiAgICApXG4gICAgLnNvcnQoXG4gICAgICAoYTogW3N0cmluZywgbnVtYmVyXSwgYjogW3N0cmluZywgbnVtYmVyXSkgPT4gYlswXS5sZW5ndGggLSBhWzBdLmxlbmd0aFxuICAgICk7XG5cbiAgaWYgKHJlbGF0aXZlRW50cmllcy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgcmVsUGF0dGVybiA9IHJlbGF0aXZlRW50cmllcy5tYXAoKFtrXTogW3N0cmluZywgbnVtYmVyXSkgPT4gaykuam9pbihcInxcIik7XG4gICAgemhDaHJvbm8ucGFyc2Vycy5wdXNoKHtcbiAgICAgIHBhdHRlcm46ICgpID0+IG5ldyBSZWdFeHAocmVsUGF0dGVybiksXG4gICAgICBleHRyYWN0OiAoY29udGV4dDogYW55LCBtYXRjaDogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IFpIX1JFTEFUSVZFX0RBWVNbbWF0Y2hbMF0gYXMgc3RyaW5nXTtcbiAgICAgICAgaWYgKG9mZnNldCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc3QgcmVmRGF0ZSA9IGNvbnRleHQucmVmRGF0ZSB8fCBuZXcgRGF0ZSgpO1xuICAgICAgICAgIGNvbnN0IHRhcmdldCA9IG5ldyBEYXRlKHJlZkRhdGUpO1xuICAgICAgICAgIHRhcmdldC5zZXREYXRlKHRhcmdldC5nZXREYXRlKCkgKyBvZmZzZXQpO1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkYXk6IHRhcmdldC5nZXREYXRlKCksXG4gICAgICAgICAgICBtb250aDogdGFyZ2V0LmdldE1vbnRoKCkgKyAxLFxuICAgICAgICAgICAgeWVhcjogdGFyZ2V0LmdldEZ1bGxZZWFyKCksXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0sXG4gICAgfSBhcyBQYXJzZXIpO1xuICB9XG5cbiAgcmV0dXJuIHpoQ2hyb25vO1xufVxuXG4vLyDmnoTlu7rnlKjkuo7mraPliJnnmoTmqKHlvI/niYfmrrVcbmZ1bmN0aW9uIGJ1aWxkUGF0dGVybih3b3Jkczogc3RyaW5nW10pOiBzdHJpbmcge1xuICByZXR1cm4gd29yZHMuc29ydCgoYTogc3RyaW5nLCBiOiBzdHJpbmcpID0+IGIubGVuZ3RoIC0gYS5sZW5ndGgpLmpvaW4oXCJ8XCIpO1xufVxuXG5jb25zdCBUSElTX1BBVFRFUk4gPSBidWlsZFBhdHRlcm4oWkhfVEhJUyk7XG5jb25zdCBORVhUX1BBVFRFUk4gPSBidWlsZFBhdHRlcm4oWkhfTkVYVCk7XG5jb25zdCBXRUVLX1BBVFRFUk4gPSBidWlsZFBhdHRlcm4oWkhfV0VFS19XT1JEUyk7XG5jb25zdCBNT05USF9QQVRURVJOID0gYnVpbGRQYXR0ZXJuKFpIX01PTlRIX1dPUkRTKTtcbmNvbnN0IFlFQVJfUEFUVEVSTiA9IGJ1aWxkUGF0dGVybihaSF9ZRUFSX1dPUkRTKTtcbmNvbnN0IEVORF9PRl9NT05USF9QQVRURVJOID0gYnVpbGRQYXR0ZXJuKFpIX1BPU0lUSU9OLmVuZE9mTW9udGgpO1xuY29uc3QgTUlEX09GX01PTlRIX1BBVFRFUk4gPSBidWlsZFBhdHRlcm4oWkhfUE9TSVRJT04ubWlkT2ZNb250aCk7XG5cbi8vIOWuieWFqOino+aekOaXpeacn++8jOWksei0peaXtui/lOWbnuW9k+WJjeaXpeacn1xuZnVuY3Rpb24gc2FmZVBhcnNlRGF0ZShwYXJzZXI6IENocm9ubywgdGV4dDogc3RyaW5nLCByZWZEYXRlPzogRGF0ZSwgb3B0aW9uPzogY2hyb25vLlBhcnNpbmdPcHRpb24pOiBEYXRlIHtcbiAgY29uc3QgcmVzdWx0ID0gcGFyc2VyLnBhcnNlRGF0ZSh0ZXh0LCByZWZEYXRlLCBvcHRpb24pO1xuICByZXR1cm4gcmVzdWx0ID8/IG5ldyBEYXRlKCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE5MRFBhcnNlciB7XG4gIGNocm9ubzogQ2hyb25vO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuY2hyb25vID0gY3JlYXRlWmhDaHJvbm8oKTtcbiAgfVxuXG4gIGdldFBhcnNlZERhdGUoc2VsZWN0ZWRUZXh0OiBzdHJpbmcsIHdlZWtTdGFydFByZWZlcmVuY2U6IERheU9mV2Vlayk6IERhdGUge1xuICAgIGNvbnN0IHBhcnNlciA9IHRoaXMuY2hyb25vO1xuICAgIGNvbnN0IGluaXRpYWxQYXJzZSA9IHBhcnNlci5wYXJzZShzZWxlY3RlZFRleHQpO1xuICAgIGNvbnN0IHdlZWtkYXlJc0NlcnRhaW4gPSBpbml0aWFsUGFyc2VbMF0/LnN0YXJ0LmlzQ2VydGFpbihcIndlZWtkYXlcIik7XG5cbiAgICBjb25zdCB3ZWVrU3RhcnQgPVxuICAgICAgd2Vla1N0YXJ0UHJlZmVyZW5jZSA9PT0gXCJsb2NhbGUtZGVmYXVsdFwiXG4gICAgICAgID8gZ2V0TG9jYWxlV2Vla1N0YXJ0KClcbiAgICAgICAgOiB3ZWVrU3RhcnRQcmVmZXJlbmNlO1xuXG4gICAgLy8gLS0tLSDnibnmrormqKHlvI/lpITnkIYgLS0tLVxuXG4gICAgLy8g44CM6L+Z5ZGoIC8g5pys5ZGoIC8g6L+Z5Liq5pif5pyf44CN4oaSIOacrOWRqOesrOS4gOWkqVxuICAgIGNvbnN0IHRoaXNXZWVrUmUgPSBuZXcgUmVnRXhwKFxuICAgICAgYF4oPzoke1RISVNfUEFUVEVSTn0pXFxcXHMqKD86JHtXRUVLX1BBVFRFUk59KSRgXG4gICAgKTtcbiAgICBpZiAodGhpc1dlZWtSZS50ZXN0KHNlbGVjdGVkVGV4dC50cmltKCkpKSB7XG4gICAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIGDmnKzlkagke3dlZWtTdGFydH1gLCBuZXcgRGF0ZSgpKTtcbiAgICB9XG5cbiAgICAvLyDjgIzkuIvlkaggLyDkuIvkuKrmmJ/mnJ/jgI3ihpIg5LiL5ZGo56ys5LiA5aSpXG4gICAgY29uc3QgbmV4dFdlZWtSZSA9IG5ldyBSZWdFeHAoXG4gICAgICBgXig/OiR7TkVYVF9QQVRURVJOfSlcXFxccyooPzoke1dFRUtfUEFUVEVSTn0pJGBcbiAgICApO1xuICAgIGlmIChuZXh0V2Vla1JlLnRlc3Qoc2VsZWN0ZWRUZXh0LnRyaW0oKSkpIHtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgYOS4i+WRqCR7d2Vla1N0YXJ0fWAsIG5ldyBEYXRlKCksIHtcbiAgICAgICAgZm9yd2FyZERhdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjgIzkuIvkuKrmnIggLyDkuIvmnIjjgI1cbiAgICBjb25zdCBuZXh0TW9udGhSZSA9IG5ldyBSZWdFeHAoXG4gICAgICBgXig/OiR7TkVYVF9QQVRURVJOfSlcXFxccyooPzoke01PTlRIX1BBVFRFUk59KSRgXG4gICAgKTtcbiAgICBpZiAobmV4dE1vbnRoUmUudGVzdChzZWxlY3RlZFRleHQudHJpbSgpKSkge1xuICAgICAgY29uc3QgdGhpc01vbnRoID0gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIFwi5pys5pyIXCIsIG5ldyBEYXRlKCksIHtcbiAgICAgICAgZm9yd2FyZERhdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgc2VsZWN0ZWRUZXh0LCB0aGlzTW9udGgsIHtcbiAgICAgICAgZm9yd2FyZERhdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjgIzmmI7lubQgLyDmnaXlubTjgI1cbiAgICBjb25zdCBuZXh0WWVhclJlID0gbmV3IFJlZ0V4cChcbiAgICAgIGBeKD86JHtORVhUX1BBVFRFUk59fOaYjilcXFxccyooPzoke1lFQVJfUEFUVEVSTn0pJGBcbiAgICApO1xuICAgIGlmIChuZXh0WWVhclJlLnRlc3Qoc2VsZWN0ZWRUZXh0LnRyaW0oKSkpIHtcbiAgICAgIGNvbnN0IHRoaXNZZWFyID0gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIFwi5LuK5bm0XCIsIG5ldyBEYXRlKCksIHtcbiAgICAgICAgZm9yd2FyZERhdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgc2VsZWN0ZWRUZXh0LCB0aGlzWWVhciwge1xuICAgICAgICBmb3J3YXJkRGF0ZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOOAjOaciOW6lSAvIOaciOacq+OAjeKGkiDlvZPmnIjmnIDlkI7kuIDlpKlcbiAgICBjb25zdCBlbmRPZk1vbnRoUmUgPSBuZXcgUmVnRXhwKFxuICAgICAgYCgke0VORF9PRl9NT05USF9QQVRURVJOfSlcXFxccyooW15cXFxcblxcXFxyXSopYFxuICAgICk7XG4gICAgY29uc3QgZW5kT2ZNb250aE1hdGNoID0gc2VsZWN0ZWRUZXh0Lm1hdGNoKGVuZE9mTW9udGhSZSk7XG4gICAgaWYgKGVuZE9mTW9udGhNYXRjaCkge1xuICAgICAgY29uc3QgY29udGV4dFN0ciA9IGVuZE9mTW9udGhNYXRjaFsyXS50cmltKCkgfHwgXCLmnKzmnIhcIjtcbiAgICAgIGNvbnN0IHRlbXBEYXRlID0gcGFyc2VyLnBhcnNlKGNvbnRleHRTdHIpO1xuICAgICAgY29uc3QgeWVhciA9XG4gICAgICAgIHRlbXBEYXRlWzBdPy5zdGFydC5nZXQoXCJ5ZWFyXCIpID8/IG1vbWVudCgpLnllYXIoKTtcbiAgICAgIGNvbnN0IG1vbnRoID1cbiAgICAgICAgdGVtcERhdGVbMF0/LnN0YXJ0LmdldChcIm1vbnRoXCIpID8/IG1vbWVudCgpLm1vbnRoKCkgKyAxO1xuICAgICAgY29uc3QgbGFzdERheSA9IGdldExhc3REYXlPZk1vbnRoKHllYXIsIG1vbnRoKTtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKFxuICAgICAgICBwYXJzZXIsXG4gICAgICAgIGAke3llYXJ9LSR7bW9udGh9LSR7bGFzdERheX1gLFxuICAgICAgICBuZXcgRGF0ZSgpLFxuICAgICAgICB7IGZvcndhcmREYXRlOiB0cnVlIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g44CM5pyI5Lit44CN4oaSIOW9k+aciCAxNSDml6VcbiAgICBjb25zdCBtaWRPZk1vbnRoUmUgPSBuZXcgUmVnRXhwKFxuICAgICAgYCgke01JRF9PRl9NT05USF9QQVRURVJOfSlcXFxccyooW15cXFxcblxcXFxyXSopYFxuICAgICk7XG4gICAgY29uc3QgbWlkT2ZNb250aE1hdGNoID0gc2VsZWN0ZWRUZXh0Lm1hdGNoKG1pZE9mTW9udGhSZSk7XG4gICAgaWYgKG1pZE9mTW9udGhNYXRjaCkge1xuICAgICAgY29uc3QgY29udGV4dFN0ciA9IG1pZE9mTW9udGhNYXRjaFsyXS50cmltKCkgfHwgXCLmnKzmnIhcIjtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgYCR7Y29udGV4dFN0cn0gMTXml6VgLCBuZXcgRGF0ZSgpLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g6buY6K6k77ya5Lqk57uZIGNocm9ubyB6aC5oYW5zIOino+aekFxuICAgIGNvbnN0IHJlZmVyZW5jZURhdGUgPSB3ZWVrZGF5SXNDZXJ0YWluXG4gICAgICA/IG1vbWVudCgpLndlZWtkYXkoMCkudG9EYXRlKClcbiAgICAgIDogbmV3IERhdGUoKTtcblxuICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgc2VsZWN0ZWRUZXh0LCByZWZlcmVuY2VEYXRlKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBOYXR1cmFsTGFuZ3VhZ2VEYXRlcyBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgeyBnZXRMb2NhbGVXZWVrU3RhcnQgfSBmcm9tIFwiLi91dGlsc1wiO1xuXG5leHBvcnQgdHlwZSBEYXlPZldlZWsgPVxuICB8IFwic3VuZGF5XCJcbiAgfCBcIm1vbmRheVwiXG4gIHwgXCJ0dWVzZGF5XCJcbiAgfCBcIndlZG5lc2RheVwiXG4gIHwgXCJ0aHVyc2RheVwiXG4gIHwgXCJmcmlkYXlcIlxuICB8IFwic2F0dXJkYXlcIlxuICB8IFwibG9jYWxlLWRlZmF1bHRcIjtcblxuZXhwb3J0IGludGVyZmFjZSBOTERTZXR0aW5ncyB7XG4gIGF1dG9zdWdnZXN0VG9nZ2xlTGluazogYm9vbGVhbjtcbiAgYXV0b2NvbXBsZXRlVHJpZ2dlclBocmFzZTogc3RyaW5nO1xuICBpc0F1dG9zdWdnZXN0RW5hYmxlZDogYm9vbGVhbjtcblxuICBmb3JtYXQ6IHN0cmluZztcbiAgZGVmYXVsdEFsaWFzOiBzdHJpbmc7XG4gIHdlZWtTdGFydDogRGF5T2ZXZWVrO1xuXG4gIG1vZGFsVG9nZ2xlTGluazogYm9vbGVhbjtcbiAgbW9kYWxNb21lbnRGb3JtYXQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IE5MRFNldHRpbmdzID0ge1xuICBhdXRvc3VnZ2VzdFRvZ2dsZUxpbms6IHRydWUsXG4gIGF1dG9jb21wbGV0ZVRyaWdnZXJQaHJhc2U6IFwiQFwiLFxuICBpc0F1dG9zdWdnZXN0RW5hYmxlZDogdHJ1ZSxcblxuICBmb3JtYXQ6IFwiWVlZWS1NTS1ERFwiLFxuICBkZWZhdWx0QWxpYXM6IFwiXCIsXG4gIHdlZWtTdGFydDogXCJsb2NhbGUtZGVmYXVsdFwiLFxuXG4gIG1vZGFsVG9nZ2xlTGluazogZmFsc2UsXG4gIG1vZGFsTW9tZW50Rm9ybWF0OiBcIllZWVktTU0tRERcIixcbn07XG5cbmNvbnN0IHdlZWtkYXlzID0gW1xuICBcInN1bmRheVwiLFxuICBcIm1vbmRheVwiLFxuICBcInR1ZXNkYXlcIixcbiAgXCJ3ZWRuZXNkYXlcIixcbiAgXCJ0aHVyc2RheVwiLFxuICBcImZyaWRheVwiLFxuICBcInNhdHVyZGF5XCIsXG5dO1xuXG5leHBvcnQgY2xhc3MgTkxEU2V0dGluZ3NUYWIgZXh0ZW5kcyBQbHVnaW5TZXR0aW5nVGFiIHtcbiAgcGx1Z2luOiBOYXR1cmFsTGFuZ3VhZ2VEYXRlcztcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBOYXR1cmFsTGFuZ3VhZ2VEYXRlcykge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb25zdCBsb2NhbGl6ZWRXZWVrZGF5cyA9IHdpbmRvdy5tb21lbnQud2Vla2RheXMoKTtcbiAgICBjb25zdCBsb2NhbGVXZWVrU3RhcnQgPSBnZXRMb2NhbGVXZWVrU3RhcnQoKTtcblxuICAgIGNvbnRhaW5lckVsLmVtcHR5KCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIuagvOW8j1wiKS5zZXRIZWFkaW5nKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwi5pel5pyf5qC85byPXCIpXG4gICAgICAuc2V0RGVzYyhcIuaXpeacn+eahOaYvuekuuagvOW8j++8jOS9v+eUqCBNb21lbnQuanMg5qC85byP5a2X56ym5LiyXCIpXG4gICAgICAuYWRkTW9tZW50Rm9ybWF0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldERlZmF1bHRGb3JtYXQoXCJZWVlZLU1NLUREXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmZvcm1hdClcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb3JtYXQgPSB2YWx1ZSB8fCBcIllZWVktTU0tRERcIjtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIuS4gOWRqOS7juWRqOWHoOW8gOWni1wiKVxuICAgICAgLnNldERlc2MoXCLpgInmi6nkuIDlkajnmoTotbflp4vml6VcIilcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgICAgZHJvcGRvd24uYWRkT3B0aW9uKFxuICAgICAgICAgIFwibG9jYWxlLWRlZmF1bHRcIixcbiAgICAgICAgICBg57O757uf6buY6K6k77yIJHtTdHJpbmcobG9jYWxlV2Vla1N0YXJ0KX3vvIlgXG4gICAgICAgICk7XG4gICAgICAgIGxvY2FsaXplZFdlZWtkYXlzLmZvckVhY2goKGRheSwgaSkgPT4ge1xuICAgICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbih3ZWVrZGF5c1tpXSwgZGF5KTtcbiAgICAgICAgfSk7XG4gICAgICAgIGRyb3Bkb3duLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLndlZWtTdGFydC50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgZHJvcGRvd24ub25DaGFuZ2UoYXN5bmMgKHZhbHVlOiBEYXlPZldlZWspID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQgPSB2YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwi6Ieq5Yqo5bu66K6uXCIpLnNldEhlYWRpbmcoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLlkK/nlKjml6XmnJ/oh6rliqjlu7rorq5cIilcbiAgICAgIC5zZXREZXNjKFxuICAgICAgICBg5byA5ZCv5ZCO77yM6L6T5YWlICR7dGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b2NvbXBsZXRlVHJpZ2dlclBocmFzZX0g5Lya6Kem5Y+R5pel5pyf5bu66K6u6I+c5Y2VYFxuICAgICAgKVxuICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlKSA9PlxuICAgICAgICB0b2dnbGVcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaXNBdXRvc3VnZ2VzdEVuYWJsZWQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaXNBdXRvc3VnZ2VzdEVuYWJsZWQgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIuinpuWPkeWtl+esplwiKVxuICAgICAgLnNldERlc2MoXCLovpPlhaXmraTlrZfnrKbop6blj5Hoh6rliqjlu7rorq5cIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PlxuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKFwiQFwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvY29tcGxldGVUcmlnZ2VyUGhyYXNlIHx8IFwiQFwiKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9jb21wbGV0ZVRyaWdnZXJQaHJhc2UgPSB2YWx1ZS50cmltKCkgfHwgXCJAXCI7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLml6XmnJ/ljIXoo7nkuLrpk77mjqVcIilcbiAgICAgIC5zZXREZXNjKFwi5byA5ZCv5ZCO77yM6Ieq5Yqo5bu66K6u55qE5pel5pyf5Lya5YyF6KO55ZyoIFtbd2lraWxpbmtdXSDkuK1cIilcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9zdWdnZXN0VG9nZ2xlTGluaylcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvc3VnZ2VzdFRvZ2dsZUxpbmsgPSB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIumTvuaOpem7mOiupOWIq+WQjeagvOW8j1wiKVxuICAgICAgLnNldERlc2MoXCLliJvlu7ogd2lraSDpk77mjqXml7bnmoTpu5jorqTliKvlkI3moLzlvI/vvIhNb21lbnQuanMg5qC85byP77yJ77yM55WZ56m65YiZ5peg5Yir5ZCNXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIuS+i+Wmgu+8mk1N5pyIRETml6VcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuZGVmYXVsdEFsaWFzKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZmF1bHRBbGlhcyA9IHZhbHVlIHx8IFwiXCI7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICB9XG59XG4iLCJpbXBvcnQge1xuICBBcHAsXG4gIEVkaXRvcixcbiAgRWRpdG9yUG9zaXRpb24sXG4gIEVkaXRvclN1Z2dlc3QsXG4gIEVkaXRvclN1Z2dlc3RDb250ZXh0LFxuICBFZGl0b3JTdWdnZXN0VHJpZ2dlckluZm8sXG59IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgTmF0dXJhbExhbmd1YWdlRGF0ZXMgZnJvbSBcInNyYy9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZU1hcmtkb3duTGluaywgZ2V0RGF0ZUxpbmtBbGlhcyB9IGZyb20gXCJzcmMvdXRpbHNcIjtcbmltcG9ydCB7XG4gIFpIX1dFRUtEQVlTX1NIT1JULFxuICBaSF9XRUVLREFZU19MT05HLFxuICBaSF9SRUxBVElWRV9EQVlTLFxufSBmcm9tIFwic3JjL2xvY2FsZVwiO1xuXG5pbnRlcmZhY2UgSURhdGVDb21wbGV0aW9uIHtcbiAgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGF0ZVN1Z2dlc3QgZXh0ZW5kcyBFZGl0b3JTdWdnZXN0PElEYXRlQ29tcGxldGlvbj4ge1xuICBhcHA6IEFwcDtcbiAgcHJpdmF0ZSBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblxuICAgIHRoaXMuc2NvcGUucmVnaXN0ZXIoW1wiU2hpZnRcIl0sIFwiRW50ZXJcIiwgKGV2dDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgKFxuICAgICAgICB0aGlzIGFzIHVua25vd24gYXMge1xuICAgICAgICAgIHN1Z2dlc3Rpb25zOiB7IHVzZVNlbGVjdGVkSXRlbShldnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIH07XG4gICAgICAgIH1cbiAgICAgICkuc3VnZ2VzdGlvbnMudXNlU2VsZWN0ZWRJdGVtKGV2dCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b3N1Z2dlc3RUb2dnbGVMaW5rKSB7XG4gICAgICB0aGlzLnNldEluc3RydWN0aW9ucyhbXG4gICAgICAgIHsgY29tbWFuZDogXCJTaGlmdFwiLCBwdXJwb3NlOiBcIuS9v+eUqOWOn+Wni+i+k+WFpeS9nOS4uuWIq+WQjVwiIH0sXG4gICAgICBdKTtcbiAgICB9XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhjb250ZXh0OiBFZGl0b3JTdWdnZXN0Q29udGV4dCk6IElEYXRlQ29tcGxldGlvbltdIHtcbiAgICBjb25zdCBzdWdnZXN0aW9ucyA9IHRoaXMuZ2V0RGF0ZVN1Z2dlc3Rpb25zKGNvbnRleHQpO1xuICAgIGlmIChzdWdnZXN0aW9ucy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgICB9XG4gICAgcmV0dXJuIFt7IGxhYmVsOiBjb250ZXh0LnF1ZXJ5IH1dO1xuICB9XG5cbiAgZ2V0RGF0ZVN1Z2dlc3Rpb25zKFxuICAgIGNvbnRleHQ6IEVkaXRvclN1Z2dlc3RDb250ZXh0IHwgeyBxdWVyeTogc3RyaW5nIH0sXG4gICAgZGVmYXVsdHM6IHN0cmluZ1tdID0gW1wi5LuK5aSpXCIsIFwi5piO5aSpXCIsIFwi5pio5aSpXCIsIFwi5ZCO5aSpXCJdXG4gICk6IElEYXRlQ29tcGxldGlvbltdIHtcbiAgICBjb25zdCBxdWVyeSA9IGNvbnRleHQucXVlcnkudHJpbSgpO1xuXG4gICAgLy8g5LiK5LiL5paH5Yy56YWN77ya44CM5LiL44CN4oaSIOS4i+WRqOOAgeS4i+S4quaciOOAgeS4i+WRqOS4gH7lkajml6VcbiAgICBpZiAoL17kuIsvLnRlc3QocXVlcnkpKSB7XG4gICAgICBjb25zdCBzdWdnZXN0aW9ucyA9IFtcbiAgICAgICAgXCLkuIvlkahcIixcbiAgICAgICAgXCLkuIvkuKrmnIhcIixcbiAgICAgICAgXCLkuIvlubRcIixcbiAgICAgICAgLi4uWkhfV0VFS0RBWVNfU0hPUlQubWFwKChkKSA9PiBg5LiLJHtkfWApLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19MT05HLm1hcCgoZCkgPT4gYOS4iyR7ZH1gKSxcbiAgICAgIF07XG4gICAgICByZXR1cm4gc3VnZ2VzdGlvbnNcbiAgICAgICAgLm1hcCgobGFiZWwpID0+ICh7IGxhYmVsIH0pKVxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICB9XG5cbiAgICAvLyDjgIzkuIrjgI3ihpIg5LiK5ZGo44CB5LiK5Liq5pyI44CB5LiK5ZGo5LiAfuWRqOaXpVxuICAgIGlmICgvXuS4ii8udGVzdChxdWVyeSkpIHtcbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gW1xuICAgICAgICBcIuS4iuWRqFwiLFxuICAgICAgICBcIuS4iuS4quaciFwiLFxuICAgICAgICBcIuS4iuW5tFwiLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19TSE9SVC5tYXAoKGQpID0+IGDkuIoke2R9YCksXG4gICAgICAgIC4uLlpIX1dFRUtEQVlTX0xPTkcubWFwKChkKSA9PiBg5LiKJHtkfWApLFxuICAgICAgXTtcbiAgICAgIHJldHVybiBzdWdnZXN0aW9uc1xuICAgICAgICAubWFwKChsYWJlbCkgPT4gKHsgbGFiZWwgfSkpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0ubGFiZWwuc3RhcnRzV2l0aChxdWVyeSkpO1xuICAgIH1cblxuICAgIC8vIOOAjOi/mS/mnKzjgI3ihpIg6L+Z5ZGo44CB6L+Z5Liq5pyIXG4gICAgaWYgKC9eKOi/mXzmnKwpLy50ZXN0KHF1ZXJ5KSkge1xuICAgICAgY29uc3Qgc3VnZ2VzdGlvbnMgPSBbXCLov5nlkahcIiwgXCLov5nkuKrmnIhcIl07XG4gICAgICByZXR1cm4gc3VnZ2VzdGlvbnNcbiAgICAgICAgLm1hcCgobGFiZWwpID0+ICh7IGxhYmVsIH0pKVxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICB9XG5cbiAgICAvLyDmlbDlrZflvIDlpLTvvJpO5aSp5ZCO44CBTuWkqeWJjeOAgU7lkajlkI4uLi5cbiAgICBjb25zdCBudW1NYXRjaCA9IHF1ZXJ5Lm1hdGNoKC9eKFxcZCspLyk7XG4gICAgaWYgKG51bU1hdGNoKSB7XG4gICAgICBjb25zdCBuID0gbnVtTWF0Y2hbMV07XG4gICAgICByZXR1cm4gW1xuICAgICAgICBgJHtufeWkqeWQjmAsXG4gICAgICAgIGAke2595aSp5YmNYCxcbiAgICAgICAgYCR7bn3lkajlkI5gLFxuICAgICAgICBgJHtufeWRqOWJjWAsXG4gICAgICAgIGAke2595Liq5pyI5ZCOYCxcbiAgICAgICAgYCR7bn3kuKrmnIjliY1gLFxuICAgICAgXVxuICAgICAgICAubWFwKChsYWJlbCkgPT4gKHsgbGFiZWwgfSkpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0ubGFiZWwuc3RhcnRzV2l0aChxdWVyeSkpO1xuICAgIH1cblxuICAgIC8vIOS4reaWh+aVsOWtl+W8gOWktO+8muS4ieWkqeWQjuOAgeS6lOWkqeWQji4uLlxuICAgIGNvbnN0IHpoTnVtTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgXCLkuIBcIjogXCIxXCIsIFwi5LqMXCI6IFwiMlwiLCBcIuS4iVwiOiBcIjNcIiwgXCLlm5tcIjogXCI0XCIsIFwi5LqUXCI6IFwiNVwiLFxuICAgICAgXCLlha1cIjogXCI2XCIsIFwi5LiDXCI6IFwiN1wiLCBcIuWFq1wiOiBcIjhcIiwgXCLkuZ1cIjogXCI5XCIsIFwi5Y2BXCI6IFwiMTBcIixcbiAgICB9O1xuICAgIGNvbnN0IHpoTnVtTWF0Y2ggPSBxdWVyeS5tYXRjaCgvXihb5LiA5LqM5LiJ5Zub5LqU5YWt5LiD5YWr5Lmd5Y2BXSkvKTtcbiAgICBpZiAoemhOdW1NYXRjaCkge1xuICAgICAgY29uc3QgbiA9IHpoTnVtTWFwW3poTnVtTWF0Y2hbMV1dO1xuICAgICAgaWYgKG4pIHtcbiAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeWkqeWQjmAsXG4gICAgICAgICAgYCR7emhOdW1NYXRjaFsxXX3lpKnliY1gLFxuICAgICAgICAgIGAke3poTnVtTWF0Y2hbMV195ZGo5ZCOYCxcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeWRqOWJjWAsXG4gICAgICAgICAgYCR7emhOdW1NYXRjaFsxXX3kuKrmnIjlkI5gLFxuICAgICAgICAgIGAke3poTnVtTWF0Y2hbMV195Liq5pyI5YmNYCxcbiAgICAgICAgXVxuICAgICAgICAgIC5tYXAoKGxhYmVsKSA9PiAoeyBsYWJlbCB9KSlcbiAgICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdHNcbiAgICAgIC5tYXAoKGxhYmVsKSA9PiAoeyBsYWJlbCB9KSlcbiAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0ubGFiZWwuc3RhcnRzV2l0aChxdWVyeSkpO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBJRGF0ZUNvbXBsZXRpb24sIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLnNldFRleHQoc3VnZ2VzdGlvbi5sYWJlbCk7XG4gIH1cblxuICBzZWxlY3RTdWdnZXN0aW9uKFxuICAgIHN1Z2dlc3Rpb246IElEYXRlQ29tcGxldGlvbixcbiAgICBldmVudDogS2V5Ym9hcmRFdmVudCB8IE1vdXNlRXZlbnRcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgY29udGV4dCA9IHRoaXMuY29udGV4dDtcbiAgICBpZiAoIWNvbnRleHQpIHJldHVybjtcblxuICAgIGNvbnN0IHsgZWRpdG9yIH0gPSBjb250ZXh0O1xuXG4gICAgY29uc3QgaW5jbHVkZUFsaWFzID0gZXZlbnQuc2hpZnRLZXk7XG4gICAgbGV0IG1ha2VJbnRvTGluayA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9zdWdnZXN0VG9nZ2xlTGluaztcblxuICAgIGNvbnN0IHBhcnNlZERhdGUgPSB0aGlzLnBsdWdpbi5wYXJzZURhdGUoc3VnZ2VzdGlvbi5sYWJlbCk7XG4gICAgbGV0IGRhdGVTdHIgPSBwYXJzZWREYXRlLmZvcm1hdHRlZFN0cmluZztcblxuICAgIGlmIChtYWtlSW50b0xpbmspIHtcbiAgICAgIGNvbnN0IGFsaWFzID0gaW5jbHVkZUFsaWFzXG4gICAgICAgID8gY29udGV4dC5xdWVyeSB8fCBzdWdnZXN0aW9uLmxhYmVsXG4gICAgICAgIDogZ2V0RGF0ZUxpbmtBbGlhcyh0aGlzLnBsdWdpbiwgc3VnZ2VzdGlvbi5sYWJlbCwgZmFsc2UpIHx8IHN1Z2dlc3Rpb24ubGFiZWw7XG4gICAgICBkYXRlU3RyID0gZ2VuZXJhdGVNYXJrZG93bkxpbmsodGhpcy5hcHAsIGRhdGVTdHIsIGFsaWFzKTtcbiAgICB9XG5cbiAgICBlZGl0b3IucmVwbGFjZVJhbmdlKGRhdGVTdHIsIGNvbnRleHQuc3RhcnQsIGNvbnRleHQuZW5kKTtcbiAgICB0aGlzLmNsb3NlKCk7XG4gIH1cblxuICBvblRyaWdnZXIoXG4gICAgY3Vyc29yOiBFZGl0b3JQb3NpdGlvbixcbiAgICBlZGl0b3I6IEVkaXRvclxuICApOiBFZGl0b3JTdWdnZXN0VHJpZ2dlckluZm8gfCBudWxsIHtcbiAgICBpZiAoIXRoaXMucGx1Z2luLnNldHRpbmdzLmlzQXV0b3N1Z2dlc3RFbmFibGVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB0cmlnZ2VyUGhyYXNlID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b2NvbXBsZXRlVHJpZ2dlclBocmFzZTtcbiAgICBjb25zdCBzdGFydFBvcyA9IHRoaXMuY29udGV4dD8uc3RhcnQgfHwge1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUsXG4gICAgICBjaDogY3Vyc29yLmNoIC0gdHJpZ2dlclBocmFzZS5sZW5ndGgsXG4gICAgfTtcblxuICAgIGlmICghZWRpdG9yLmdldFJhbmdlKHN0YXJ0UG9zLCBjdXJzb3IpLnN0YXJ0c1dpdGgodHJpZ2dlclBocmFzZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHByZWNlZGluZ0NoYXIgPSBlZGl0b3IuZ2V0UmFuZ2UoXG4gICAgICB7XG4gICAgICAgIGxpbmU6IHN0YXJ0UG9zLmxpbmUsXG4gICAgICAgIGNoOiBzdGFydFBvcy5jaCAtIDEsXG4gICAgICB9LFxuICAgICAgc3RhcnRQb3NcbiAgICApO1xuXG4gICAgLy8g6YG/5YWN5Zyo6YKu566x5Zyw5Z2A562J5Zy65pmv6K+v6Kem5Y+RXG4gICAgaWYgKHByZWNlZGluZ0NoYXIgJiYgL1tgYS16QS1aMC05XS8udGVzdChwcmVjZWRpbmdDaGFyKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcXVlcnkgPSBlZGl0b3JcbiAgICAgIC5nZXRSYW5nZShzdGFydFBvcywgY3Vyc29yKVxuICAgICAgLnN1YnN0cmluZyh0cmlnZ2VyUGhyYXNlLmxlbmd0aCk7XG5cbiAgICAvLyDop6blj5HlrZfnrKblkI7ntKfot5/nqbrmoLzliJnlj5bmtohcbiAgICBpZiAocXVlcnkgPT09IFwiIFwiKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RhcnQ6IHN0YXJ0UG9zLFxuICAgICAgZW5kOiBjdXJzb3IsXG4gICAgICBxdWVyeSxcbiAgICB9O1xuICB9XG59XG4iLCJpbXBvcnQgeyBNYXJrZG93blZpZXcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGFkanVzdEN1cnNvciwgZ2V0U2VsZWN0ZWRUZXh0LCBnZXREYXRlTGlua0FsaWFzIH0gZnJvbSBcIi4vdXRpbHNcIjtcbmltcG9ydCB0eXBlIE5hdHVyYWxMYW5ndWFnZURhdGVzIGZyb20gXCIuL21haW5cIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFBhcnNlQ29tbWFuZChcbiAgcGx1Z2luOiBOYXR1cmFsTGFuZ3VhZ2VEYXRlcyxcbiAgbW9kZTogc3RyaW5nXG4pOiB2b2lkIHtcbiAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHBsdWdpbi5hcHA7XG4gIGNvbnN0IGFjdGl2ZVZpZXcgPSB3b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuXG4gIGlmICghYWN0aXZlVmlldykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGVkaXRvciA9IGFjdGl2ZVZpZXcuZWRpdG9yO1xuICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XG4gIGNvbnN0IHNlbGVjdGVkVGV4dCA9IGdldFNlbGVjdGVkVGV4dChlZGl0b3IpO1xuXG4gIGNvbnN0IGRhdGUgPSBwbHVnaW4ucGFyc2VEYXRlKHNlbGVjdGVkVGV4dCk7XG5cbiAgaWYgKCFkYXRlLm1vbWVudC5pc1ZhbGlkKCkpIHtcbiAgICBlZGl0b3Iuc2V0Q3Vyc29yKHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lLFxuICAgICAgY2g6IGN1cnNvci5jaCxcbiAgICB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgbmV3U3RyOiBzdHJpbmc7XG5cbiAgaWYgKG1vZGUgPT09IFwicmVwbGFjZVwiKSB7XG4gICAgY29uc3QgYWxpYXMgPSBnZXREYXRlTGlua0FsaWFzKHBsdWdpbiwgc2VsZWN0ZWRUZXh0LCBmYWxzZSk7XG4gICAgbmV3U3RyID0gYWxpYXNcbiAgICAgID8gYFtbJHtkYXRlLmZvcm1hdHRlZFN0cmluZ318JHthbGlhc31dXWBcbiAgICAgIDogYFtbJHtkYXRlLmZvcm1hdHRlZFN0cmluZ31dXWA7XG4gIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJsaW5rXCIpIHtcbiAgICBuZXdTdHIgPSBgWyR7c2VsZWN0ZWRUZXh0fV0oJHtkYXRlLmZvcm1hdHRlZFN0cmluZ30pYDtcbiAgfSBlbHNlIGlmIChtb2RlID09PSBcImNsZWFuXCIpIHtcbiAgICBuZXdTdHIgPSBkYXRlLmZvcm1hdHRlZFN0cmluZztcbiAgfVxuXG4gIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKG5ld1N0ciEpO1xuICBhZGp1c3RDdXJzb3IoZWRpdG9yLCBjdXJzb3IsIG5ld1N0ciEsIHNlbGVjdGVkVGV4dCk7XG4gIGVkaXRvci5mb2N1cygpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0TW9tZW50Q29tbWFuZChcbiAgcGx1Z2luOiBOYXR1cmFsTGFuZ3VhZ2VEYXRlcyxcbiAgZGF0ZTogRGF0ZSxcbiAgZm9ybWF0OiBzdHJpbmdcbik6IHZvaWQge1xuICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gcGx1Z2luLmFwcDtcbiAgY29uc3QgYWN0aXZlVmlldyA9IHdvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG5cbiAgaWYgKGFjdGl2ZVZpZXcpIHtcbiAgICBjb25zdCBlZGl0b3IgPSBhY3RpdmVWaWV3LmVkaXRvcjtcbiAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih3aW5kb3cubW9tZW50KGRhdGUpLmZvcm1hdChmb3JtYXQpKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Q3VycmVudERhdGVDb21tYW5kKHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXMpOiB2b2lkIHtcbiAgY29uc3QgZm9ybWF0ID0gcGx1Z2luLnNldHRpbmdzLmZvcm1hdDtcbiAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKCk7XG4gIGluc2VydE1vbWVudENvbW1hbmQocGx1Z2luLCBkYXRlLCBmb3JtYXQpO1xufVxuIiwiaW1wb3J0IHsgTm90aWNlLCBTdWdnZXN0TW9kYWwsIEFwcCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZ2V0T3JDcmVhdGVEYWlseU5vdGUgfSBmcm9tIFwiLi4vdXRpbHNcIjtcbmltcG9ydCB0eXBlIE5hdHVyYWxMYW5ndWFnZURhdGVzIGZyb20gXCIuLi9tYWluXCI7XG5pbXBvcnQgRGF0ZVN1Z2dlc3QgZnJvbSBcIi4uL3N1Z2dlc3QvZGF0ZS1zdWdnZXN0XCI7XG5cbmV4cG9ydCBjbGFzcyBPcGVuRGFpbHlOb3RlTW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8c3RyaW5nPiB7XG4gIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXM7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXMpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCLovpPlhaXkuK3mlofml6XmnJ/vvIzlpoLvvJrku4rlpKnjgIHkuIvlkajkuInjgIEz5aSp5ZCOXCIpO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCB0ZW1wU3VnZ2VzdCA9IG5ldyBEYXRlU3VnZ2VzdCh0aGlzLmFwcCwgdGhpcy5wbHVnaW4pO1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gdGVtcFN1Z2dlc3QuZ2V0RGF0ZVN1Z2dlc3Rpb25zKFxuICAgICAgeyBxdWVyeSB9LFxuICAgICAgW1wi5LuK5aSpXCIsIFwi5pio5aSpXCIsIFwi5piO5aSpXCJdXG4gICAgKTtcbiAgICByZXR1cm4gc3VnZ2VzdGlvbnMubWFwKChzKSA9PiBzLmxhYmVsKS5sZW5ndGhcbiAgICAgID8gc3VnZ2VzdGlvbnMubWFwKChzKSA9PiBzLmxhYmVsKVxuICAgICAgOiBbcXVlcnldO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBzdHJpbmcsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogc3VnZ2VzdGlvbiB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBwYXJzZWREYXRlID0gdGhpcy5wbHVnaW4ucGFyc2VEYXRlKHN1Z2dlc3Rpb24pO1xuICAgIGNvbnN0IGRhdGUgPSBwYXJzZWREYXRlLm1vbWVudDtcbiAgICBpZiAoIXBhcnNlZERhdGUuZGF0ZSB8fCAhZGF0ZS5pc1ZhbGlkKCkpIHtcbiAgICAgIG5ldyBOb3RpY2UoXCLml6Dms5Xop6PmnpDor6Xml6XmnJ9cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdm9pZCBnZXRPckNyZWF0ZURhaWx5Tm90ZShkYXRlKS50aGVuKChub3RlKSA9PiB7XG4gICAgICBpZiAobm90ZSkge1xuICAgICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUobm90ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1hcmtkb3duVmlldywgT2JzaWRpYW5Qcm90b2NvbERhdGEsIFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgRGF0ZVBpY2tlck1vZGFsIGZyb20gXCIuL21vZGFscy9kYXRlLXBpY2tlclwiO1xuaW1wb3J0IE5MRFBhcnNlciwgeyBOTERSZXN1bHQgfSBmcm9tIFwiLi9wYXJzZXJcIjtcbmltcG9ydCB7IE5MRFNldHRpbmdzVGFiLCBOTERTZXR0aW5ncywgREVGQVVMVF9TRVRUSU5HUyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgRGF0ZVN1Z2dlc3QgZnJvbSBcIi4vc3VnZ2VzdC9kYXRlLXN1Z2dlc3RcIjtcbmltcG9ydCB7XG4gIGdldFBhcnNlQ29tbWFuZCxcbiAgZ2V0Q3VycmVudERhdGVDb21tYW5kLFxufSBmcm9tIFwiLi9jb21tYW5kc1wiO1xuaW1wb3J0IHsgZ2V0Rm9ybWF0dGVkRGF0ZSwgZ2V0T3JDcmVhdGVEYWlseU5vdGUsIHBhcnNlVHJ1dGh5IH0gZnJvbSBcIi4vdXRpbHNcIjtcbmltcG9ydCB7IE9wZW5EYWlseU5vdGVNb2RhbCB9IGZyb20gXCIuL21vZGFscy9vcGVuLWRhaWx5LW5vdGVcIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTmF0dXJhbExhbmd1YWdlRGF0ZXMgZXh0ZW5kcyBQbHVnaW4ge1xuICBwcml2YXRlIHBhcnNlcjogTkxEUGFyc2VyO1xuICBwdWJsaWMgc2V0dGluZ3M6IE5MRFNldHRpbmdzO1xuXG4gIGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm5scC1kYXRlc1wiLFxuICAgICAgbmFtZTogXCLop6PmnpDoh6rnhLbor63oqIDml6XmnJ9cIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiBnZXRQYXJzZUNvbW1hbmQodGhpcywgXCJyZXBsYWNlXCIpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm5scC1kYXRlcy1saW5rXCIsXG4gICAgICBuYW1lOiBcIuino+aekOiHqueEtuivreiogOaXpeacn++8iE1hcmtkb3duIOmTvuaOpe+8iVwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IGdldFBhcnNlQ29tbWFuZCh0aGlzLCBcImxpbmtcIiksXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibmxwLWRhdGUtY2xlYW5cIixcbiAgICAgIG5hbWU6IFwi6Kej5p6Q6Ieq54S26K+t6KiA5pel5pyf77yI57qv5paH5pys77yJXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4gZ2V0UGFyc2VDb21tYW5kKHRoaXMsIFwiY2xlYW5cIiksXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibmxwLXRvZGF5XCIsXG4gICAgICBuYW1lOiBcIuaPkuWFpeW9k+WJjeaXpeacn1wiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IGdldEN1cnJlbnREYXRlQ29tbWFuZCh0aGlzKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJubHAtcGlja2VyXCIsXG4gICAgICBuYW1lOiBcIuaXpeacn+mAieaLqeWZqFwiLFxuICAgICAgY2hlY2tDYWxsYmFjazogKGNoZWNraW5nOiBib29sZWFuKSA9PiB7XG4gICAgICAgIGlmIChjaGVja2luZykge1xuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICAgIH1cbiAgICAgICAgbmV3IERhdGVQaWNrZXJNb2RhbCh0aGlzLmFwcCwgdGhpcykub3BlbigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJubHAtb3Blbi1kYWlseS1ub3RlXCIsXG4gICAgICBuYW1lOiBcIueUqOiHqueEtuivreiogOaJk+W8gOaXpeiusFwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgY29uc3QgbW9kYWwgPSBuZXcgT3BlbkRhaWx5Tm90ZU1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICAgICAgbW9kYWwub3BlbigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgTkxEU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICB0aGlzLnJlZ2lzdGVyT2JzaWRpYW5Qcm90b2NvbEhhbmRsZXIoXG4gICAgICBcIm5sZGF0ZXNcIixcbiAgICAgIChwYXJhbXMpID0+IHZvaWQgdGhpcy5hY3Rpb25IYW5kbGVyKHBhcmFtcylcbiAgICApO1xuICAgIHRoaXMucmVnaXN0ZXJFZGl0b3JTdWdnZXN0KG5ldyBEYXRlU3VnZ2VzdCh0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgICAgdGhpcy5wYXJzZXIgPSBuZXcgTkxEUGFyc2VyKCk7XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmRlYnVnKFwi5Y246L296Ieq54S26K+t6KiA5pel5pyf5o+S5Lu277yI5Lit5paH77yJXCIpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKFxuICAgICAge30sXG4gICAgICBERUZBVUxUX1NFVFRJTkdTLFxuICAgICAgKGF3YWl0IHRoaXMubG9hZERhdGEoKSkgYXMgUGFydGlhbDxOTERTZXR0aW5ncz5cbiAgICApO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBwYXJzZShkYXRlU3RyaW5nOiBzdHJpbmcsIGZvcm1hdDogc3RyaW5nKTogTkxEUmVzdWx0IHtcbiAgICBjb25zdCBkYXRlID0gdGhpcy5wYXJzZXIuZ2V0UGFyc2VkRGF0ZShcbiAgICAgIGRhdGVTdHJpbmcsXG4gICAgICB0aGlzLnNldHRpbmdzLndlZWtTdGFydFxuICAgICk7XG4gICAgY29uc3QgZm9ybWF0dGVkU3RyaW5nID0gZ2V0Rm9ybWF0dGVkRGF0ZShkYXRlLCBmb3JtYXQpO1xuICAgIGlmIChmb3JtYXR0ZWRTdHJpbmcgPT09IFwiSW52YWxpZCBkYXRlXCIpIHtcbiAgICAgIGNvbnNvbGUuZGVidWcoYG5sZGF0ZXMg5peg5rOV6Kej5p6Q6L6T5YWlIFwiJHtkYXRlU3RyaW5nfVwiYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGZvcm1hdHRlZFN0cmluZyxcbiAgICAgIGRhdGUsXG4gICAgICBtb21lbnQ6IHdpbmRvdy5tb21lbnQoZGF0ZSksXG4gICAgfTtcbiAgfVxuXG4gIHBhcnNlRGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcpOiBOTERSZXN1bHQge1xuICAgIHJldHVybiB0aGlzLnBhcnNlKGRhdGVTdHJpbmcsIHRoaXMuc2V0dGluZ3MuZm9ybWF0KTtcbiAgfVxuXG4gIGFzeW5jIGFjdGlvbkhhbmRsZXIocGFyYW1zOiBPYnNpZGlhblByb3RvY29sRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgd29ya3NwYWNlIH0gPSB0aGlzLmFwcDtcblxuICAgIGNvbnN0IGRhdGUgPSB0aGlzLnBhcnNlRGF0ZShwYXJhbXMuZGF5KTtcbiAgICBjb25zdCBuZXdQYW5lID0gcGFyc2VUcnV0aHkocGFyYW1zLm5ld1BhbmUgfHwgXCJ5ZXNcIik7XG5cbiAgICBpZiAoZGF0ZS5tb21lbnQuaXNWYWxpZCgpKSB7XG4gICAgICBjb25zdCBkYWlseU5vdGUgPSBhd2FpdCBnZXRPckNyZWF0ZURhaWx5Tm90ZShkYXRlLm1vbWVudCk7XG4gICAgICBpZiAoZGFpbHlOb3RlKSB7XG4gICAgICAgIGF3YWl0IHdvcmtzcGFjZS5nZXRMZWFmKG5ld1BhbmUpLm9wZW5GaWxlKGRhaWx5Tm90ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOlsibm9ybWFsaXplUGF0aCIsIk5vdGljZSIsIlZhdWx0IiwiVEZpbGUiLCJNb2RhbCIsIlNldHRpbmciLCJNYXJrZG93blZpZXciLCJZRUFSX1BBVFRFUk4iLCJQQVRURVJOIiwiREFURV9HUk9VUCIsIkRBVEVfVE9fR1JPVVAiLCJNT05USF9OQU1FX0dST1VQIiwiWUVBUl9HUk9VUCIsIlBSRUZJWF9HUk9VUCIsIllFQVJfTlVNQkVSX0dST1VQIiwiTU9OVEhfTlVNQkVSX0dST1VQIiwiREFURV9OVU1CRVJfR1JPVVAiLCJNT05USF9HUk9VUCIsIkhPVVJfR1JPVVAiLCJNSU5VVEVfR1JPVVAiLCJTRUNPTkRfR1JPVVAiLCJBTV9QTV9IT1VSX0dST1VQIiwiU1RSSUNUX1BBVFRFUk4iLCJkYXRlcy5pbXBseVNpbWlsYXJEYXRlIiwicmVmZXJlbmNlcy5ub3ciLCJyZWZlcmVuY2VzLnRvZGF5IiwicmVmZXJlbmNlcy55ZXN0ZXJkYXkiLCJyZWZlcmVuY2VzLnRvbW9ycm93IiwicmVmZXJlbmNlcy50b25pZ2h0IiwicmVmZXJlbmNlcy50aGVEYXlBZnRlciIsImNhc3VhbFJlZmVyZW5jZXMuYWZ0ZXJub29uIiwiY2FzdWFsUmVmZXJlbmNlcy5ldmVuaW5nIiwiY2FzdWFsUmVmZXJlbmNlcy5taWRuaWdodCIsImNhc3VhbFJlZmVyZW5jZXMubW9ybmluZyIsImNhc3VhbFJlZmVyZW5jZXMubm9vbiIsIkRBWV9HUk9VUF8xIiwiREFZX0dST1VQXzMiLCJjaHJvbm8uemguaGFucy5jcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uIiwibW9tZW50IiwiUGx1Z2luU2V0dGluZ1RhYiIsIkVkaXRvclN1Z2dlc3QiLCJTdWdnZXN0TW9kYWwiLCJQbHVnaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUFxQkEsTUFBTSx5QkFBeUIsR0FBRyxZQUFZLENBQUM7QUFxQi9DLFNBQVMsTUFBTSxHQUFBO0lBQ2IsT0FBUSxNQUFjLENBQUMsR0FBdUIsQ0FBQztBQUNqRCxDQUFDO0FBRUQsU0FBUyw4QkFBOEIsQ0FBQyxXQUFtQixFQUFBOztJQUN6RCxNQUFNLE1BQU0sR0FBRyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUU3QyxDQUFDO0FBQ2QsSUFBQSxPQUFPLE9BQU8sQ0FBQyxDQUFBLEVBQUEsR0FBQSxDQUFBLEVBQUEsR0FBQSxNQUFNLGFBQU4sTUFBTSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFOLE1BQU0sQ0FBRSxRQUFRLE1BQUcsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENB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SUFDeEIsVUFBVSxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ2xCLFlBQVksRUFBRSxDQUFDLElBQUksQ0FBQztBQUNwQixJQUFBLFNBQVMsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO0lBQzdCLFdBQVcsRUFBRSxDQUFDLElBQUksQ0FBQztDQUNwQixDQUFDO0FBRUY7QUFDTyxNQUFNLGdCQUFnQixHQUFtRDtJQUM5RSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDMUIsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzNCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMxQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDMUIsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzFCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMxQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDMUIsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzNCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7SUFDNUIsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzdCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUM3QixLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7SUFDNUIsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzNCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUM3QixLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7SUFDN0IsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzNCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDMUIsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzNCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7Q0FDM0I7O0FDekZELE1BQU0sVUFBVSxHQUF3QztJQUN0RCxRQUFRO0lBQ1IsUUFBUTtJQUNSLFNBQVM7SUFDVCxXQUFXO0lBQ1gsVUFBVTtJQUNWLFFBQVE7SUFDUixVQUFVO0NBQ1gsQ0FBQztBQVlzQixTQUFBLGlCQUFpQixDQUFDLE1BQWMsRUFBQTtBQUN0RCxJQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNsQyxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3ZDLElBQUEsTUFBTSxJQUFJ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QUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEtBQUssRUFBRSxHQUFHO0FBQ2QsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEtBQUssRUFBRSxHQUFHO0FBQ2QsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxLQUFLLEVBQUUsR0FBRztBQUNkLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLElBQUksRUFBRSxDQUFDLEdBQUc7QUFDZCxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLEVBQUU7QUFDWCxJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxF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QUMsR0FBRztBQUNkLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxJQUFJLEVBQUUsQ0FBQyxHQUFHO0FBQ2QsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRztBQUNiLElBQUksS0FBSyxFQUFFLEdBQUc7QUFDZCxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxFQUFFO0FBQ1gsSUFBSSxJQUFJLEVBQUUsRUFBRTtBQUNaLElBQUksSUFBSSxFQUFFLEVBQUU7QUFDWixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLElBQUksRUFBRSxDQUFDLEdBQUc7QUFDZCxJQUFJLEdBQUcsRUFBRSxDQUFDLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxFQUFFLEVBQUUsQ0FBQztBQUNULElBQUksS0FBSyxFQUFFLEdBQUc7QUFDZCxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksS0FBSyxFQUFFLEdBQUc7QUFDZCxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsQ0FBQyxDQUFDO0FBQ0ssU0FBUyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsRUFBRTtBQUN4RSxJQUFJLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztBQUN2QixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNkLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ2xCLFFBQVEsVUFBVSxFQUFFLENBQUM7QUFDckIsUUFBUSxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxVQUFVLENBQUMsQ0FBQztBQUMzRCxRQUFRLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxLQUFLLE9BQU87QUFDckMsWUFBWSxDQUFDLEVBQUUsQ0FBQztBQUNoQixLQUFLO0FBQ0wsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN2RCxDQUFDO0FBQ00sU0FBUyxxQkFBcUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxJQUFJLEdBQUcsQ0FBQyxFQUFFO0FBQ3RFLElBQUksTUFBTSxpQkFBaUIsR0FBRyxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUM7QUFDMUQsSUFBSSxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3RELElBQUksTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDMUUsSUFBSSxJQUFJLE9BQU8sQ0FBQztBQUNoQixJQUFJLElBQUkscUJBQXFCLEtBQUssaUJBQWlCO0FBQ25ELFFBQVEsT0FBTyxHQUFHLENBQUMsQ0FBQztBQUNwQixTQUFTLElBQUkscUJBQXFCLEdBQUcsaUJBQWlCO0FBQ3RELFFBQVEsT0FBTyxHQUFHLENBQUMsR0FBRyxxQkFBcUIsR0FBRyxpQkFBaUIsQ0FBQztBQUNoRTtBQUNBLFFBQVEsT0FBTyxHQUFHLHFCQUFxQixHQUFHLGlCQUFpQixDQUFDO0FBQzVELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsT0FBTyxDQUFDLENBQUM7QUFDM0MsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBQ00sU0FBUyxnQkFBZ0IsQ0FBQyxhQUFhLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixHQUFHLEVBQUUsRUFBRTtBQUM5RSxJQUFJLElBQUksYUFBYSxJQUFJLElBQUksRUFBRTtBQUMvQixRQUFRLE9BQU8sSUFBSSxDQUFDO0FBQ3BCLEtBQUs7QUFDTCxJQUFJLElBQUksT0FBTyxhQUFhLEtBQUssUUFBUSxFQUFFO0FBQzNDLFFBQVEsT0FBTyxhQUFhLENBQUM7QUFDN0IsS0FBSztBQUNMLElBQUksTUFBTSxlQUFlLEdBQUcsaUJBQWlCLENBQUMsYUFBYSxDQUFDLElBQUksaUJBQWlCLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDakcsSUFBSSxJQUFJLGVBQWUsSUFBSSxJQUFJLEVBQUU7QUFDakMsUUFBUSxPQUFPLElBQUksQ0FBQztBQUNwQixLQUFLO0FBQ0wsSUFBSSxJQUFJLE9BQU8sZUFBZSxJQUFJLFFBQVEsRUFBRTtBQUM1QyxRQUFRLE9BQU8sZUFBZSxDQUFDO0FBQy9CLEtBQUs7QUFDTCxJQUFJLElBQUksSUFBSSxJQUFJLElBQUksRUFBRTtBQUN0QixRQUFRLE9BQU8sSUFBSSxDQUFDO0FBQ3BCLEtBQUs7QUFDTCxJQUFJLElBQUksSUFBSSxHQUFHLGVBQWUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ3JILFFBQVEsT0FBTyxlQUFlLENBQUMsdUJBQXVCLENBQUM7QUFDdkQsS0FBSztBQUNMLElBQUksT0FBTyxlQUFlLENBQUMsb0JBQW9CLENBQUM7QUFDaEQ7O0FDM1FPLE1BQU0sYUFBYSxHQUFHO0FBQzdCLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixJQUFJLE1BQU0sRUFBRSxDQUFDO0FBQ2IsSUFBSSxXQUFXLEVBQUUsQ0FBQztBQUNsQixDQUFDLENBQUM7QUFDSyxTQUFTLFdBQVcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFO0FBQzNDLElBQUksSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0IsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN4QixRQUFRLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDM0MsUUFBUSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDMUMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0MsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0MsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN4QixRQUFRLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakQsUUFBUSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixLQUFLO0FBQ0wsSUFBSSxJQUFJLE1BQU0sSUFB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QUFDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUN2RCxZQUFZLE9BQU8sTUFBTSxDQUFDO0FBQzFCLFNBQVM7QUFDVCxRQUFRLElBQUksUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUM3QixZQUFZLFFBQVEsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3JDLFNBQVM7QUFDVCxhQUFhLElBQUksUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNsQyxZQUFZLFFBQVEsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3JDLFNBQVM7QUFDVCxhQUFhLElBQUksUUFBUSxJQUFJLEdBQUcsSUFBSSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ3JELFlBQVksUUFBUSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUM7QUFDbkMsU0FBUztBQUNULFFBQVEsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDNUQsUUFBUSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDdkQsUUFBUSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3pELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ2xELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBQ3JELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQ3pELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElB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

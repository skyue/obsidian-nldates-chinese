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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsic3JjL2RhaWx5LW5vdGVzLnRzIiwic3JjL2xvY2FsZS50cyIsInNyYy91dGlscy50cyIsInNyYy9tb2RhbHMvZGF0ZS1waWNrZXIudHMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vdHlwZXMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vdXRpbHMvZGF0ZXMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vdGltZXpvbmUuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY2FsY3VsYXRpb24vZHVyYXRpb24uanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vcmVzdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS91dGlscy9wYXR0ZXJuLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NhbGN1bGF0aW9uL3llYXJzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vY29uc3RhbnRzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5UaW1lVW5pdFdpdGhpbkZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5Nb250aE5hbWVMaXR0bGVFbmRpYW5QYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTk1vbnRoTmFtZVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5ZZWFyTW9udGhEYXlQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOU2xhc2hNb250aEZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlRpbWVFeHByZXNzaW9uUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlRpbWVVbml0QWdvRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL2Fic3RyYWN0UmVmaW5lcnMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL0Fic3RyYWN0TWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcmVmaW5lcnMvRU5NZXJnZURhdGVSYW5nZVJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY2FsY3VsYXRpb24vbWVyZ2luZ0NhbGN1bGF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcmVmaW5lcnMvRU5NZXJnZURhdGVUaW1lUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcmVmaW5lcnMvRXh0cmFjdFRpbWV6b25lQWJiclJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL0V4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL092ZXJsYXBSZW1vdmFsUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jYWxjdWxhdGlvbi93ZWVrZGF5cy5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcmVmaW5lcnMvRm9yd2FyZERhdGVSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9Vbmxpa2VseUZvcm1hdEZpbHRlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcGFyc2Vycy9JU09Gb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL01lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29uZmlndXJhdGlvbnMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL2Nhc3VhbFJlZmVyZW5jZXMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOQ2FzdWFsRGF0ZVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5DYXN1YWxUaW1lUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTldlZWtkYXlQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOUmVsYXRpdmVEYXRlRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9wYXJzZXJzL1NsYXNoRGF0ZUZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5UaW1lVW5pdENhc3VhbFJlbGF0aXZlRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcmVmaW5lcnMvRU5NZXJnZVJlbGF0aXZlQWZ0ZXJEYXRlUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3JlZmluZXJzL0VOTWVyZ2VSZWxhdGl2ZUZvbGxvd0J5RGF0ZVJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9yZWZpbmVycy9FTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3JlZmluZXJzL0VOVW5saWtlbHlGb3JtYXRGaWx0ZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9jb25maWd1cmF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2Nocm9uby5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvY29uc3RhbnRzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc0RhdGVQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL3BhcnNlcnMvWkhIYW5zRGVhZGxpbmVGb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL3BhcnNlcnMvWkhIYW5zUmVsYXRpb25XZWVrZGF5UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc1RpbWVFeHByZXNzaW9uUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc1dlZWtkYXlQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL3BhcnNlcnMvWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvcmVmaW5lcnMvWkhIYW5zTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9yZWZpbmVycy9aSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvaW5kZXguanMiLCJzcmMvcGFyc2VyLnRzIiwic3JjL3NldHRpbmdzLnRzIiwic3JjL3N1Z2dlc3QvZGF0ZS1zdWdnZXN0LnRzIiwic3JjL2NvbW1hbmRzLnRzIiwic3JjL21vZGFscy9vcGVuLWRhaWx5LW5vdGUudHMiLCJzcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBub3JtYWxpemVQYXRoLCBOb3RpY2UsIFRGaWxlLCBURm9sZGVyLCBWYXVsdCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG50eXBlIE1vbWVudEluc3RhbmNlID0gUmV0dXJuVHlwZTx0eXBlb2Ygd2luZG93Lm1vbWVudD47XG5cbmludGVyZmFjZSBJRm9sZCB7XG4gIGZyb206IG51bWJlcjtcbiAgdG86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElGb2xkSW5mbyB7XG4gIGZvbGRzOiBJRm9sZFtdO1xufVxuXG5pbnRlcmZhY2UgSVBlcmlvZGljTm90ZVNldHRpbmdzIHtcbiAgZm9sZGVyPzogc3RyaW5nO1xuICBmb3JtYXQ/OiBzdHJpbmc7XG4gIHRlbXBsYXRlPzogc3RyaW5nO1xufVxuXG50eXBlIElHcmFudWxhcml0eSA9IFwiZGF5XCIgfCBcIndlZWtcIiB8IFwibW9udGhcIiB8IFwicXVhcnRlclwiIHwgXCJ5ZWFyXCI7XG5cbmNvbnN0IERFRkFVTFRfREFJTFlfTk9URV9GT1JNQVQgPSBcIllZWVktTU0tRERcIjtcblxuaW50ZXJmYWNlIEFwcFdpdGhJbnRlcm5hbHMge1xuICB2YXVsdDogVmF1bHQ7XG4gIHBsdWdpbnM6IHtcbiAgICBnZXRQbHVnaW4oaWQ6IHN0cmluZyk6IHVua25vd247XG4gIH07XG4gIGludGVybmFsUGx1Z2luczoge1xuICAgIGdldFBsdWdpbkJ5SWQoXG4gICAgICBpZDogc3RyaW5nXG4gICAgKTogeyBpbnN0YW5jZT86IHsgb3B0aW9ucz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0gfSB8IHVuZGVmaW5lZDtcbiAgfTtcbiAgZm9sZE1hbmFnZXI6IHtcbiAgICBzYXZlKGZpbGU6IFRGaWxlLCBmb2xkSW5mbzogSUZvbGRJbmZvKTogdm9pZDtcbiAgICBsb2FkKGZpbGU6IFRGaWxlKTogSUZvbGRJbmZvO1xuICB9O1xuICBtZXRhZGF0YUNhY2hlOiB7XG4gICAgZ2V0Rmlyc3RMaW5rcGF0aERlc3QobGlua3BhdGg6IHN0cmluZywgc291cmNlUGF0aDogc3RyaW5nKTogVEZpbGUgfCBudWxsO1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRBcHAoKTogQXBwV2l0aEludGVybmFscyB7XG4gIHJldHVybiAod2luZG93IGFzIHVua25vd24gYXMgeyBhcHA6IEFwcFdpdGhJbnRlcm5hbHMgfSkuYXBwO1xufVxuXG5mdW5jdGlvbiBzaG91bGRVc2VQZXJpb2RpY05vdGVzU2V0dGluZ3MocGVyaW9kaWNpdHk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBwbHVnaW4gPSBnZXRBcHAoKS5wbHVnaW5zLmdldFBsdWdpbihcInBlcmlvZGljLW5vdGVzXCIpIGFzXG4gICAgfCB7IHNldHRpbmdzPzogUmVjb3JkPHN0cmluZywgeyBlbmFibGVkPzogYm9vbGVhbiB9PiB9XG4gICAgfCB1bmRlZmluZWQ7XG4gIHJldHVybiBCb29sZWFuKHBsdWdpbj8uc2V0dGluZ3M/LltwZXJpb2RpY2l0eV0/LmVuYWJsZWQpO1xufVxuXG5mdW5jdGlvbiBnZXREYWlseU5vdGVTZXR0aW5ncygpOiBJUGVyaW9kaWNOb3RlU2V0dGluZ3Mge1xuICB0cnkge1xuICAgIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuXG4gICAgaWYgKHNob3VsZFVzZVBlcmlvZGljTm90ZXNTZXR0aW5ncyhcImRhaWx5XCIpKSB7XG4gICAgICBjb25zdCBwbHVnaW4gPSBhcHAucGx1Z2lucy5nZXRQbHVnaW4oXCJwZXJpb2RpYy1ub3Rlc1wiKSBhc1xuICAgICAgICB8IHtcbiAgICAgICAgICAgIHNldHRpbmdzPzoge1xuICAgICAgICAgICAgICBkYWlseT86IHsgZm9ybWF0Pzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IHRlbXBsYXRlPzogc3RyaW5nIH07XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBkYWlseSA9IHBsdWdpbj8uc2V0dGluZ3M/LmRhaWx5IHx8IHt9O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZm9ybWF0OlxuICAgICAgICAgIHR5cGVvZiBkYWlseS5mb3JtYXQgPT09IFwic3RyaW5nXCJcbiAgICAgICAgICAgID8gZGFpbHkuZm9ybWF0XG4gICAgICAgICAgICA6IERFRkFVTFRfREFJTFlfTk9URV9GT1JNQVQsXG4gICAgICAgIGZvbGRlcjogdHlwZW9mIGRhaWx5LmZvbGRlciA9PT0gXCJzdHJpbmdcIiA/IGRhaWx5LmZvbGRlci50cmltKCkgOiBcIlwiLFxuICAgICAgICB0ZW1wbGF0ZTpcbiAgICAgICAgICB0eXBlb2YgZGFpbHkudGVtcGxhdGUgPT09IFwic3RyaW5nXCIgPyBkYWlseS50ZW1wbGF0ZS50cmltKCkgOiBcIlwiLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBwbHVnaW4gPSBhcHAuaW50ZXJuYWxQbHVnaW5zLmdldFBsdWdpbkJ5SWQoXCJkYWlseS1ub3Rlc1wiKTtcbiAgICBjb25zdCBvcHRpb25zID0gcGx1Z2luPy5pbnN0YW5jZT8ub3B0aW9ucyBhc1xuICAgICAgfCB7IGZvbGRlcj86IHN0cmluZzsgZm9ybWF0Pzogc3RyaW5nOyB0ZW1wbGF0ZT86IHN0cmluZyB9XG4gICAgICB8IHVuZGVmaW5lZDtcbiAgICByZXR1cm4ge1xuICAgICAgZm9ybWF0OlxuICAgICAgICB0eXBlb2Ygb3B0aW9ucz8uZm9ybWF0ID09PSBcInN0cmluZ1wiXG4gICAgICAgICAgPyBvcHRpb25zLmZvcm1hdFxuICAgICAgICAgIDogREVGQVVMVF9EQUlMWV9OT1RFX0ZPUk1BVCxcbiAgICAgIGZvbGRlcjogdHlwZW9mIG9wdGlvbnM/LmZvbGRlciA9PT0gXCJzdHJpbmdcIiA/IG9wdGlvbnMuZm9sZGVyLnRyaW0oKSA6IFwiXCIsXG4gICAgICB0ZW1wbGF0ZTpcbiAgICAgICAgdHlwZW9mIG9wdGlvbnM/LnRlbXBsYXRlID09PSBcInN0cmluZ1wiID8gb3B0aW9ucy50ZW1wbGF0ZS50cmltKCkgOiBcIlwiLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUud2FybihcIuaXoOazleivu+WPluaXpeiusOiuvue9rlwiLCBlcnIpO1xuICAgIHJldHVybiB7XG4gICAgICBmb3JtYXQ6IERFRkFVTFRfREFJTFlfTk9URV9GT1JNQVQsXG4gICAgICBmb2xkZXI6IFwiXCIsXG4gICAgICB0ZW1wbGF0ZTogXCJcIixcbiAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldERhdGVVSUQoXG4gIGRhdGU6IE1vbWVudEluc3RhbmNlLFxuICBncmFudWxhcml0eTogSUdyYW51bGFyaXR5ID0gXCJkYXlcIlxuKTogc3RyaW5nIHtcbiAgY29uc3QgdHMgPSBkYXRlLmNsb25lKCkuc3RhcnRPZihncmFudWxhcml0eSkuZm9ybWF0KCk7XG4gIHJldHVybiBgJHtncmFudWxhcml0eX0tJHt0c31gO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFc2NhcGVkQ2hhcmFjdGVycyhmb3JtYXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmb3JtYXQucmVwbGFjZSgvXFxbW15cXF1dKlxcXS9nLCBcIlwiKTtcbn1cblxuZnVuY3Rpb24gaXNGb3JtYXRBbWJpZ3VvdXMoXG4gIGZvcm1hdDogc3RyaW5nLFxuICBncmFudWxhcml0eTogSUdyYW51bGFyaXR5XG4pOiBib29sZWFuIHtcbiAgaWYgKGdyYW51bGFyaXR5ID09PSBcIndlZWtcIikge1xuICAgIGNvbnN0IGNsZWFuRm9ybWF0ID0gcmVtb3ZlRXNjYXBlZENoYXJhY3RlcnMoZm9ybWF0KTtcbiAgICByZXR1cm4gKFxuICAgICAgL3d7MSwyfS9pLnRlc3QoY2xlYW5Gb3JtYXQpICYmXG4gICAgICAoL017MSw0fS8udGVzdChjbGVhbkZvcm1hdCkgfHwgL0R7MSw0fS8udGVzdChjbGVhbkZvcm1hdCkpXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldERhdGVGcm9tRmlsZW5hbWUoXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIGdyYW51bGFyaXR5OiBJR3JhbnVsYXJpdHlcbik6IE1vbWVudEluc3RhbmNlIHwgbnVsbCB7XG4gIGNvbnN0IGdldFNldHRpbmdzOiBSZWNvcmQ8SUdyYW51bGFyaXR5LCAoKSA9PiBJUGVyaW9kaWNOb3RlU2V0dGluZ3M+ID0ge1xuICAgIGRheTogZ2V0RGFpbHlOb3RlU2V0dGluZ3MsXG4gICAgd2VlazogZ2V0RGFpbHlOb3RlU2V0dGluZ3MsXG4gICAgbW9udGg6IGdldERhaWx5Tm90ZVNldHRpbmdzLFxuICAgIHF1YXJ0ZXI6IGdldERhaWx5Tm90ZVNldHRpbmdzLFxuICAgIHllYXI6IGdldERhaWx5Tm90ZVNldHRpbmdzLFxuICB9O1xuXG4gIGNvbnN0IHNldHRpbmdGbiA9IGdldFNldHRpbmdzW2dyYW51bGFyaXR5XTtcbiAgY29uc3QgZm9ybWF0U2V0dGluZyA9XG4gICAgKHNldHRpbmdGbigpLmZvcm1hdCA/PyBcIlwiKS5zcGxpdChcIi9cIikucG9wKCkgfHxcbiAgICBERUZBVUxUX0RBSUxZX05PVEVfRk9STUFUO1xuICBjb25zdCBub3RlRGF0ZSA9IHdpbmRvdy5tb21lbnQoZmlsZW5hbWUsIGZvcm1hdFNldHRpbmcsIHRydWUpO1xuXG4gIGlmICghbm90ZURhdGUuaXNWYWxpZCgpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBpZiAoaXNGb3JtYXRBbWJpZ3VvdXMoZm9ybWF0U2V0dGluZywgZ3JhbnVsYXJpdHkpKSB7XG4gICAgaWYgKGdyYW51bGFyaXR5ID09PSBcIndlZWtcIikge1xuICAgICAgY29uc3QgY2xlYW5Gb3JtYXQgPSByZW1vdmVFc2NhcGVkQ2hhcmFjdGVycyhmb3JtYXRTZXR0aW5nKTtcbiAgICAgIGlmICgvd3sxLDJ9L2kudGVzdChjbGVhbkZvcm1hdCkpIHtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5tb21lbnQoXG4gICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgZm9ybWF0U2V0dGluZy5yZXBsYWNlKC9NezEsNH0vZywgXCJcIikucmVwbGFjZSgvRHsxLDR9L2csIFwiXCIpLFxuICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGVEYXRlO1xufVxuXG5mdW5jdGlvbiBnZXREYXRlRnJvbUZpbGUoXG4gIGZpbGU6IFRGaWxlLFxuICBncmFudWxhcml0eTogSUdyYW51bGFyaXR5XG4pOiBNb21lbnRJbnN0YW5jZSB8IG51bGwge1xuICByZXR1cm4gZ2V0RGF0ZUZyb21GaWxlbmFtZShmaWxlLmJhc2VuYW1lLCBncmFudWxhcml0eSk7XG59XG5cbmZ1bmN0aW9uIGpvaW5QYXRocyguLi5zZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBzZWdtZW50IG9mIHNlZ21lbnRzKSB7XG4gICAgcGFydHMucHVzaCguLi5zZWdtZW50LnNwbGl0KFwiL1wiKSk7XG4gIH1cbiAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcbiAgICBpZiAoIXBhcnQgfHwgcGFydCA9PT0gXCIuXCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChwYXJ0KTtcbiAgfVxuICBpZiAocGFydHNbMF0gPT09IFwiXCIpIHtcbiAgICByZXN1bHQudW5zaGlmdChcIlwiKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0LmpvaW4oXCIvXCIpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVGb2xkZXJFeGlzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGRpcnMgPSBwYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLnNwbGl0KFwiL1wiKTtcbiAgZGlycy5wb3AoKTtcblxuICBpZiAoZGlycy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZGlyID0gam9pblBhdGhzKC4uLmRpcnMpO1xuICAgIGlmICghZ2V0QXBwKCkudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGRpcikpIHtcbiAgICAgIGF3YWl0IGdldEFwcCgpLnZhdWx0LmNyZWF0ZUZvbGRlcihkaXIpO1xuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXROb3RlUGF0aChcbiAgZGlyZWN0b3J5OiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmdcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGxldCBuYW1lID0gZmlsZW5hbWU7XG4gIGlmICghbmFtZS5lbmRzV2l0aChcIi5tZFwiKSkge1xuICAgIG5hbWUgKz0gXCIubWRcIjtcbiAgfVxuICBjb25zdCBwYXRoID0gbm9ybWFsaXplUGF0aChqb2luUGF0aHMoZGlyZWN0b3J5LCBuYW1lKSk7XG4gIGF3YWl0IGVuc3VyZUZvbGRlckV4aXN0cyhwYXRoKTtcbiAgcmV0dXJuIHBhdGg7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlbXBsYXRlSW5mbyh0ZW1wbGF0ZTogc3RyaW5nKTogUHJvbWlzZTxbc3RyaW5nLCBJRm9sZEluZm9dPiB7XG4gIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuICBjb25zdCB0ZW1wbGF0ZVBhdGggPSBub3JtYWxpemVQYXRoKHRlbXBsYXRlKTtcbiAgaWYgKHRlbXBsYXRlUGF0aCA9PT0gXCIvXCIpIHtcbiAgICByZXR1cm4gW1wiXCIsIHsgZm9sZHM6IFtdIH1dO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChcbiAgICAgIHRlbXBsYXRlUGF0aCxcbiAgICAgIFwiXCJcbiAgICApO1xuICAgIGlmICghdGVtcGxhdGVGaWxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCLmqKHmnb/mlofku7bmnKrmib7liLBcIik7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgYXBwLnZhdWx0LmNhY2hlZFJlYWQodGVtcGxhdGVGaWxlKTtcbiAgICBjb25zdCBmb2xkSW5mbyA9IGFwcC5mb2xkTWFuYWdlci5sb2FkKHRlbXBsYXRlRmlsZSk7XG4gICAgcmV0dXJuIFtjb250ZW50cywgZm9sZEluZm9dO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKGDor7vlj5bml6XorrDmqKHmnb/lpLHotKUgJyR7dGVtcGxhdGVQYXRofSdgLCBlcnIpO1xuICAgIG5ldyBOb3RpY2UoXCLor7vlj5bml6XorrDmqKHmnb/lpLHotKVcIik7XG4gICAgcmV0dXJuIFtcIlwiLCB7IGZvbGRzOiBbXSB9XTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlRGFpbHlOb3RlKFxuICBkYXRlOiBNb21lbnRJbnN0YW5jZVxuKTogUHJvbWlzZTxURmlsZT4ge1xuICBjb25zdCBhcHAgPSBnZXRBcHAoKTtcbiAgY29uc3QgeyB2YXVsdCB9ID0gYXBwO1xuXG4gIGNvbnN0IHsgdGVtcGxhdGUsIGZvcm1hdCwgZm9sZGVyIH0gPSBnZXREYWlseU5vdGVTZXR0aW5ncygpO1xuXG4gIGNvbnN0IFt0ZW1wbGF0ZUNvbnRlbnRzLCBmb2xkSW5mb10gPSBhd2FpdCBnZXRUZW1wbGF0ZUluZm8odGVtcGxhdGUgfHwgXCJcIik7XG4gIGNvbnN0IGZpbGVuYW1lID0gZGF0ZS5mb3JtYXQoZm9ybWF0KTtcbiAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBhd2FpdCBnZXROb3RlUGF0aChmb2xkZXIgfHwgXCJcIiwgZmlsZW5hbWUpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgY3JlYXRlZEZpbGUgPSBhd2FpdCB2YXVsdC5jcmVhdGUoXG4gICAgICBub3JtYWxpemVkUGF0aCxcbiAgICAgIHRlbXBsYXRlQ29udGVudHNcbiAgICAgICAgLnJlcGxhY2UoL3t7XFxzKmRhdGVcXHMqfX0vZ2ksIGZpbGVuYW1lKVxuICAgICAgICAucmVwbGFjZSgve3tcXHMqdGltZVxccyp9fS9naSwgd2luZG93Lm1vbWVudCgpLmZvcm1hdChcIkhIOm1tXCIpKVxuICAgICAgICAucmVwbGFjZSgve3tcXHMqdGl0bGVcXHMqfX0vZ2ksIGZpbGVuYW1lKVxuICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAve3tcXHMqKGRhdGV8dGltZSlcXHMqKChbKy1dXFxkKykoW3lxbXdkaHNdKSk/XFxzKig6Lis/KT99fS9naSxcbiAgICAgICAgICAoXG4gICAgICAgICAgICBfbWF0Y2g6IHN0cmluZyxcbiAgICAgICAgICAgIF90aW1lT3JEYXRlOiBzdHJpbmcsXG4gICAgICAgICAgICBjYWxjOiBzdHJpbmcsXG4gICAgICAgICAgICB0aW1lRGVsdGE6IHN0cmluZyxcbiAgICAgICAgICAgIHVuaXQ6IHN0cmluZyxcbiAgICAgICAgICAgIG1vbWVudEZvcm1hdDogc3RyaW5nXG4gICAgICAgICAgKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IHdpbmRvdy5tb21lbnQoKTtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnREYXRlID0gZGF0ZS5jbG9uZSgpLnNldCh7XG4gICAgICAgICAgICAgIGhvdXI6IG5vdy5nZXQoXCJob3VyXCIpLFxuICAgICAgICAgICAgICBtaW51dGU6IG5vdy5nZXQoXCJtaW51dGVcIiksXG4gICAgICAgICAgICAgIHNlY29uZDogbm93LmdldChcInNlY29uZFwiKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGNhbGMpIHtcbiAgICAgICAgICAgICAgY3VycmVudERhdGUuYWRkKHBhcnNlSW50KHRpbWVEZWx0YSwgMTApIGFzIG5ldmVyLCB1bml0IGFzIG5ldmVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1vbWVudEZvcm1hdCkge1xuICAgICAgICAgICAgICByZXR1cm4gY3VycmVudERhdGUuZm9ybWF0KG1vbWVudEZvcm1hdC5zdWJzdHJpbmcoMSkudHJpbSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50RGF0ZS5mb3JtYXQoZm9ybWF0KTtcbiAgICAgICAgICB9XG4gICAgICAgIClcbiAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgL3t7XFxzKnllc3RlcmRheVxccyp9fS9naSxcbiAgICAgICAgICBkYXRlLmNsb25lKCkuc3VidHJhY3QoMSwgXCJkYXlcIikuZm9ybWF0KGZvcm1hdClcbiAgICAgICAgKVxuICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAve3tcXHMqdG9tb3Jyb3dcXHMqfX0vZ2ksXG4gICAgICAgICAgZGF0ZS5jbG9uZSgpLmFkZCgxLCBcImRcIikuZm9ybWF0KGZvcm1hdClcbiAgICAgICAgKVxuICAgICk7XG5cbiAgICBhcHAuZm9sZE1hbmFnZXIuc2F2ZShjcmVhdGVkRmlsZSwgZm9sZEluZm8pO1xuXG4gICAgcmV0dXJuIGNyZWF0ZWRGaWxlO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKGDliJvlu7rmlofku7blpLHotKU6ICcke25vcm1hbGl6ZWRQYXRofSdgLCBlcnIpO1xuICAgIG5ldyBOb3RpY2UoXCLml6Dms5XliJvlu7rmlrDml6XorrDmlofku7ZcIik7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREYWlseU5vdGUoXG4gIGRhdGU6IE1vbWVudEluc3RhbmNlLFxuICBkYWlseU5vdGVzOiBSZWNvcmQ8c3RyaW5nLCBURmlsZT5cbik6IFRGaWxlIHwgbnVsbCB7XG4gIHJldHVybiBkYWlseU5vdGVzW2dldERhdGVVSUQoZGF0ZSwgXCJkYXlcIildID8/IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbGxEYWlseU5vdGVzKCk6IFJlY29yZDxzdHJpbmcsIFRGaWxlPiB7XG4gIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuICBjb25zdCB7IHZhdWx0IH0gPSBhcHA7XG4gIGNvbnN0IHsgZm9sZGVyIH0gPSBnZXREYWlseU5vdGVTZXR0aW5ncygpO1xuXG4gIGNvbnN0IGRhaWx5Tm90ZXNGb2xkZXIgPSB2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoXG4gICAgbm9ybWFsaXplUGF0aChmb2xkZXIgfHwgXCJcIilcbiAgKSBhcyBURm9sZGVyIHwgbnVsbDtcblxuICBpZiAoIWRhaWx5Tm90ZXNGb2xkZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCLmnKrmib7liLDml6XorrDmlofku7blpLlcIik7XG4gIH1cblxuICBjb25zdCBkYWlseU5vdGVzOiBSZWNvcmQ8c3RyaW5nLCBURmlsZT4gPSB7fTtcbiAgVmF1bHQucmVjdXJzZUNoaWxkcmVuKGRhaWx5Tm90ZXNGb2xkZXIsIChub3RlKSA9PiB7XG4gICAgaWYgKG5vdGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgY29uc3Qgbm90ZURhdGUgPSBnZXREYXRlRnJvbUZpbGUobm90ZSwgXCJkYXlcIik7XG4gICAgICBpZiAobm90ZURhdGUpIHtcbiAgICAgICAgY29uc3QgZGF0ZVN0cmluZyA9IGdldERhdGVVSUQobm90ZURhdGUsIFwiZGF5XCIpO1xuICAgICAgICBkYWlseU5vdGVzW2RhdGVTdHJpbmddID0gbm90ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkYWlseU5vdGVzO1xufVxuIiwiLyoqXG4gKiDkuK3mlofml6XmnJ/or43lupPvvJrluo/mlbDor43jgIHmmJ/mnJ/jgIHnm7jlr7nml6XmnJ/jgIHnibnmrorml6XmnJ9cbiAqL1xuXG4vLyAtLS0tIOW6j+aVsOivjSAtLS0tXG5leHBvcnQgY29uc3QgWkhfT1JESU5BTFM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFwi5LiAXCI6IDEsIFwi5LqMXCI6IDIsIFwi5LiJXCI6IDMsIFwi5ZubXCI6IDQsIFwi5LqUXCI6IDUsXG4gIFwi5YWtXCI6IDYsIFwi5LiDXCI6IDcsIFwi5YWrXCI6IDgsIFwi5LmdXCI6IDksIFwi5Y2BXCI6IDEwLFxuICBcIuWNgeS4gFwiOiAxMSwgXCLljYHkuoxcIjogMTIsIFwi5Y2B5LiJXCI6IDEzLCBcIuWNgeWbm1wiOiAxNCwgXCLljYHkupRcIjogMTUsXG4gIFwi5Y2B5YWtXCI6IDE2LCBcIuWNgeS4g1wiOiAxNywgXCLljYHlhatcIjogMTgsIFwi5Y2B5LmdXCI6IDE5LCBcIuS6jOWNgVwiOiAyMCxcbiAgXCLkuozljYHkuIBcIjogMjEsIFwi5LqM5Y2B5LqMXCI6IDIyLCBcIuS6jOWNgeS4iVwiOiAyMywgXCLkuozljYHlm5tcIjogMjQsIFwi5LqM5Y2B5LqUXCI6IDI1LFxuICBcIuS6jOWNgeWFrVwiOiAyNiwgXCLkuozljYHkuINcIjogMjcsIFwi5LqM5Y2B5YWrXCI6IDI4LCBcIuS6jOWNgeS5nVwiOiAyOSwgXCLkuInljYFcIjogMzAsXG4gIFwi5LiJ5Y2B5LiAXCI6IDMxLFxufTtcblxuLy8gLS0tLSDmmJ/mnJ8gLS0tLVxuZXhwb3J0IGNvbnN0IFpIX1dFRUtEQVlTX0xPTkcgPSBbXG4gIFwi5pif5pyf5LiAXCIsIFwi5pif5pyf5LqMXCIsIFwi5pif5pyf5LiJXCIsIFwi5pif5pyf5ZubXCIsIFwi5pif5pyf5LqUXCIsIFwi5pif5pyf5YWtXCIsIFwi5pif5pyf5pelXCIsXG5dO1xuXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWVNfU0hPUlQgPSBbXG4gIFwi5ZGo5LiAXCIsIFwi5ZGo5LqMXCIsIFwi5ZGo5LiJXCIsIFwi5ZGo5ZubXCIsIFwi5ZGo5LqUXCIsIFwi5ZGo5YWtXCIsIFwi5ZGo5pelXCIsXG5dO1xuXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWVNfQUxUID0gW1xuICBcIuekvOaLnOS4gFwiLCBcIuekvOaLnOS6jFwiLCBcIuekvOaLnOS4iVwiLCBcIuekvOaLnOWbm1wiLCBcIuekvOaLnOS6lFwiLCBcIuekvOaLnOWFrVwiLCBcIuekvOaLnOWkqVwiLFxuXTtcblxuLy8g5pif5pyf5ZCN56ewIOKGkiDluo/lj7fvvIgwPVN1bmRheSDlr7nlupQgbW9tZW5077yJXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWV9UT19OVU06IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFwi5pif5pyf5LiAXCI6IDEsIFwi5pif5pyf5LqMXCI6IDIsIFwi5pif5pyf5LiJXCI6IDMsIFwi5pif5pyf5ZubXCI6IDQsIFwi5pif5pyf5LqUXCI6IDUsIFwi5pif5pyf5YWtXCI6IDYsIFwi5pif5pyf5pelXCI6IDAsXG4gIFwi5ZGo5LiAXCI6IDEsIFwi5ZGo5LqMXCI6IDIsIFwi5ZGo5LiJXCI6IDMsIFwi5ZGo5ZubXCI6IDQsIFwi5ZGo5LqUXCI6IDUsIFwi5ZGo5YWtXCI6IDYsIFwi5ZGo5pelXCI6IDAsXG4gIFwi56S85ouc5LiAXCI6IDEsIFwi56S85ouc5LqMXCI6IDIsIFwi56S85ouc5LiJXCI6IDMsIFwi56S85ouc5ZubXCI6IDQsIFwi56S85ouc5LqUXCI6IDUsIFwi56S85ouc5YWtXCI6IDYsIFwi56S85ouc5aSpXCI6IDAsXG59O1xuXG4vLyAtLS0tIOebuOWvueaXpeacnyAtLS0tXG5leHBvcnQgY29uc3QgWkhfUkVMQVRJVkVfREFZUzogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHtcbiAgXCLku4rlpKlcIjogMCxcbiAgXCLku4rml6VcIjogMCxcbiAgXCLmmI7lpKlcIjogMSxcbiAgXCLmmI7ml6VcIjogMSxcbiAgXCLlkI7lpKlcIjogMixcbiAgXCLlvozlpKlcIjogMixcbiAgXCLlpKflkI7lpKlcIjogMyxcbiAgXCLlpKflvozlpKlcIjogMyxcbiAgXCLmmKjlpKlcIjogLTEsXG4gIFwi5pio5pelXCI6IC0xLFxuICBcIuWJjeWkqVwiOiAtMixcbiAgXCLlpKfliY3lpKlcIjogLTMsXG59O1xuXG4vLyAtLS0tIOWRqOacn+aMh+ekuuivjSAtLS0tXG5leHBvcnQgY29uc3QgWkhfVEhJUyA9IFtcIui/meS4qlwiLCBcIui/mVwiLCBcIuacrFwiXTtcbmV4cG9ydCBjb25zdCBaSF9ORVhUID0gW1wi5LiL5LiqXCIsIFwi5LiLXCIsIFwi5p2lXCJdO1xuZXhwb3J0IGNvbnN0IFpIX0xBU1QgPSBbXCLkuIrkuKpcIiwgXCLkuIpcIiwgXCLljrtcIl07XG5cbi8vIC0tLS0g5ZGo5pyf5Y2V5L2NIC0tLS1cbmV4cG9ydCBjb25zdCBaSF9XRUVLX1dPUkRTID0gW1wi5ZGoXCIsIFwi5pif5pyfXCIsIFwi56S85oucXCJdO1xuZXhwb3J0IGNvbnN0IFpIX01PTlRIX1dPUkRTID0gW1wi5pyIXCIsIFwi5pyI5Lu9XCJdO1xuZXhwb3J0IGNvbnN0IFpIX1lFQVJfV09SRFMgPSBbXCLlubRcIl07XG5cbi8vIC0tLS0g5pyI5Lu95ZCN56ewIC0tLS1cbmV4cG9ydCBjb25zdCBaSF9NT05USFM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFwi5LiA5pyIXCI6IDEsIFwi5LqM5pyIXCI6IDIsIFwi5LiJ5pyIXCI6IDMsIFwi5Zub5pyIXCI6IDQsIFwi5LqU5pyIXCI6IDUsIFwi5YWt5pyIXCI6IDYsXG4gIFwi5LiD5pyIXCI6IDcsIFwi5YWr5pyIXCI6IDgsIFwi5Lmd5pyIXCI6IDksIFwi5Y2B5pyIXCI6IDEwLCBcIuWNgeS4gOaciFwiOiAxMSwgXCLljYHkuozmnIhcIjogMTIsXG4gIFwiMeaciFwiOiAxLCBcIjLmnIhcIjogMiwgXCIz5pyIXCI6IDMsIFwiNOaciFwiOiA0LCBcIjXmnIhcIjogNSwgXCI25pyIXCI6IDYsXG4gIFwiN+aciFwiOiA3LCBcIjjmnIhcIjogOCwgXCI55pyIXCI6IDksIFwiMTDmnIhcIjogMTAsIFwiMTHmnIhcIjogMTEsIFwiMTLmnIhcIjogMTIsXG59O1xuXG4vLyAtLS0tIOeJueauiuS9jee9riAtLS0tXG5leHBvcnQgY29uc3QgWkhfUE9TSVRJT04gPSB7XG4gIGVuZE9mTW9udGg6IFtcIuaciOW6lVwiLCBcIuaciOacq1wiXSxcbiAgbWlkT2ZNb250aDogW1wi5pyI5LitXCJdLFxuICBzdGFydE9mTW9udGg6IFtcIuaciOWInVwiXSxcbiAgZW5kT2ZZZWFyOiBbXCLlubTlupVcIiwgXCLlubTmnKtcIiwgXCLlubTnu4hcIl0sXG4gIHN0YXJ0T2ZZZWFyOiBbXCLlubTliJ1cIl0sXG59O1xuXG4vLyAtLS0tIOeJueauiuWFrOWOhuaXpeacnyAtLS0tXG5leHBvcnQgY29uc3QgWkhfU1BFQ0lBTF9EQVRFUzogUmVjb3JkPHN0cmluZywgeyBtb250aDogbnVtYmVyOyBkYXk6IG51bWJlciB9PiA9IHtcbiAgXCLlhYPml6ZcIjogeyBtb250aDogMSwgZGF5OiAxIH0sXG4gIFwi5Yqz5Yqo6IqCXCI6IHsgbW9udGg6IDUsIGRheTogMSB9LFxuICBcIuS6lOS4gFwiOiB7IG1vbnRoOiA1LCBkYXk6IDEgfSxcbiAgXCLkupTlm5tcIjogeyBtb250aDogNSwgZGF5OiA0IH0sXG4gIFwi5YWt5LiAXCI6IHsgbW9udGg6IDYsIGRheTogMSB9LFxuICBcIuS4g+S4gFwiOiB7IG1vbnRoOiA3LCBkYXk6IDEgfSxcbiAgXCLlhavkuIBcIjogeyBtb250aDogOCwgZGF5OiAxIH0sXG4gIFwi5Zu95bqGXCI6IHsgbW9udGg6IDEwLCBkYXk6IDEgfSxcbiAgXCLljYHkuIBcIjogeyBtb250aDogMTAsIGRheTogMSB9LFxuICBcIuWco+ivnlwiOiB7IG1vbnRoOiAxMiwgZGF5OiAyNSB9LFxuICBcIuWco+ivnuiKglwiOiB7IG1vbnRoOiAxMiwgZGF5OiAyNSB9LFxuICBcIuW5s+WuieWknFwiOiB7IG1vbnRoOiAxMiwgZGF5OiAyNCB9LFxuICBcIuaDheS6uuiKglwiOiB7IG1vbnRoOiAyLCBkYXk6IDE0IH0sXG4gIFwi5oSa5Lq66IqCXCI6IHsgbW9udGg6IDQsIGRheTogMSB9LFxuICBcIuS4h+Wco+iKglwiOiB7IG1vbnRoOiAxMCwgZGF5OiAzMSB9LFxuICBcIuaEn+aBqeiKglwiOiB7IG1vbnRoOiAxMSwgZGF5OiAyNyB9LCAvLyDov5HkvLzvvIzlrp7pmYXmmK8xMeaciOesrOWbm+S4quWRqOWbm1xuICBcIumZpOWklVwiOiB7IG1vbnRoOiAxLCBkYXk6IDI4IH0sIC8vIOWGnOWOhu+8jOS7heS9nOi/keS8vFxuICBcIuWFg+WutVwiOiB7IG1vbnRoOiAyLCBkYXk6IDEyIH0sIC8vIOWGnOWOhu+8jOS7heS9nOi/keS8vFxuICBcIuerr+WNiFwiOiB7IG1vbnRoOiA2LCBkYXk6IDEgfSwgLy8g5Yac5Y6G77yM5LuF5L2c6L+R5Ly8XG4gIFwi5Lit56eLXCI6IHsgbW9udGg6IDksIGRheTogMTUgfSwgLy8g5Yac5Y6G77yM5LuF5L2c6L+R5Ly8XG4gIFwi6YeN6ZizXCI6IHsgbW9udGg6IDEwLCBkYXk6IDkgfSwgLy8g5Yac5Y6G77yM5LuF5L2c6L+R5Ly8XG4gIFwi5LiD5aSVXCI6IHsgbW9udGg6IDgsIGRheTogNCB9LCAvLyDlhpzljobvvIzku4XkvZzov5HkvLxcbn07XG5cbi8vIC0tLS0g5pWw6YeP5Y2V5L2N77yI55So5LqOIFjlpKnliY0v5ZCOIOexu+Wei++8iS0tLS1cbmV4cG9ydCBjb25zdCBaSF9OVU1CRVJfVU5JVFM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFwi5aSpXCI6IFwiZFwiLFxuICBcIuaXpVwiOiBcImRcIixcbiAgXCLlkahcIjogXCJ3XCIsXG4gIFwi5pif5pyfXCI6IFwid1wiLFxuICBcIuekvOaLnFwiOiBcIndcIixcbiAgXCLmnIhcIjogXCJNXCIsXG4gIFwi5Liq5pyIXCI6IFwiTVwiLFxuICBcIuW5tFwiOiBcInlcIixcbn07XG4iLCJpbXBvcnQge1xuICBBcHAsXG4gIEVkaXRvcixcbiAgRWRpdG9yUmFuZ2UsXG4gIEVkaXRvclBvc2l0aW9uLFxuICBub3JtYWxpemVQYXRoLFxuICBURmlsZSxcbiAgbW9tZW50LFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGNyZWF0ZURhaWx5Tm90ZSwgZ2V0QWxsRGFpbHlOb3RlcywgZ2V0RGFpbHlOb3RlIH0gZnJvbSBcIi4vZGFpbHktbm90ZXNcIjtcbmltcG9ydCB7IERheU9mV2VlayB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBaSF9PUkRJTkFMUyB9IGZyb20gXCIuL2xvY2FsZVwiO1xuXG5jb25zdCBkYXlzT2ZXZWVrOiBPbWl0PERheU9mV2VlaywgXCJsb2NhbGUtZGVmYXVsdFwiPltdID0gW1xuICBcInN1bmRheVwiLFxuICBcIm1vbmRheVwiLFxuICBcInR1ZXNkYXlcIixcbiAgXCJ3ZWRuZXNkYXlcIixcbiAgXCJ0aHVyc2RheVwiLFxuICBcImZyaWRheVwiLFxuICBcInNhdHVyZGF5XCIsXG5dO1xuXG5kZWNsYXJlIG1vZHVsZSBcIm9ic2lkaWFuXCIge1xuICBpbnRlcmZhY2UgRWRpdG9yIHtcbiAgICBjbToge1xuICAgICAgc3RhdGU6IHtcbiAgICAgICAgd29yZEF0KHBvczogbnVtYmVyKTogeyBmcm9tOiBudW1iZXI7IHRvOiBudW1iZXIgfSB8IG51bGw7XG4gICAgICB9O1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0V29yZEJvdW5kYXJpZXMoZWRpdG9yOiBFZGl0b3IpOiBFZGl0b3JSYW5nZSB7XG4gIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcbiAgY29uc3QgcG9zID0gZWRpdG9yLnBvc1RvT2Zmc2V0KGN1cnNvcik7XG4gIGNvbnN0IHdvcmQgPSBlZGl0b3IuY20uc3RhdGUud29yZEF0KHBvcyk7XG4gIGlmICghd29yZCkge1xuICAgIHJldHVybiB7XG4gICAgICBmcm9tOiBlZGl0b3Iub2Zmc2V0VG9Qb3MocG9zKSxcbiAgICAgIHRvOiBlZGl0b3Iub2Zmc2V0VG9Qb3MocG9zKSxcbiAgICB9O1xuICB9XG4gIGNvbnN0IHdvcmRTdGFydCA9IGVkaXRvci5vZmZzZXRUb1Bvcyh3b3JkLmZyb20pO1xuICBjb25zdCB3b3JkRW5kID0gZWRpdG9yLm9mZnNldFRvUG9zKHdvcmQudG8pO1xuICByZXR1cm4ge1xuICAgIGZyb206IHdvcmRTdGFydCxcbiAgICB0bzogd29yZEVuZCxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlbGVjdGVkVGV4dChlZGl0b3I6IEVkaXRvcik6IHN0cmluZyB7XG4gIGlmIChlZGl0b3Iuc29tZXRoaW5nU2VsZWN0ZWQoKSkge1xuICAgIHJldHVybiBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3Qgd29yZEJvdW5kYXJpZXMgPSBnZXRXb3JkQm91bmRhcmllcyhlZGl0b3IpO1xuICAgIGVkaXRvci5zZXRTZWxlY3Rpb24od29yZEJvdW5kYXJpZXMuZnJvbSwgd29yZEJvdW5kYXJpZXMudG8pO1xuICAgIHJldHVybiBlZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkanVzdEN1cnNvcihcbiAgZWRpdG9yOiBFZGl0b3IsXG4gIGN1cnNvcjogRWRpdG9yUG9zaXRpb24sXG4gIG5ld1N0cjogc3RyaW5nLFxuICBvbGRTdHI6IHN0cmluZ1xuKTogdm9pZCB7XG4gIGNvbnN0IGN1cnNvck9mZnNldCA9IG5ld1N0ci5sZW5ndGggLSBvbGRTdHIubGVuZ3RoO1xuICBlZGl0b3Iuc2V0Q3Vyc29yKHtcbiAgICBsaW5lOiBjdXJzb3IubGluZSxcbiAgICBjaDogY3Vyc29yLmNoICsgY3Vyc29yT2Zmc2V0LFxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEZvcm1hdHRlZERhdGUoZGF0ZTogRGF0ZSwgZm9ybWF0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gd2luZG93Lm1vbWVudChkYXRlKS5mb3JtYXQoZm9ybWF0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldExhc3REYXlPZk1vbnRoKHllYXI6IG51bWJlciwgbW9udGg6IG51bWJlcik6IG51bWJlciB7XG4gIHJldHVybiBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgMCkuZ2V0RGF0ZSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUcnV0aHkoZmxhZzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBbXCJ5XCIsIFwieWVzXCIsIFwiMVwiLCBcInRcIiwgXCJ0cnVlXCJdLmluZGV4T2YoZmxhZy50b0xvd2VyQ2FzZSgpKSA+PSAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYWxlV2Vla1N0YXJ0KCk6IE9taXQ8RGF5T2ZXZWVrLCBcImxvY2FsZS1kZWZhdWx0XCI+IHtcbiAgY29uc3QgbG9jYWxlRGF0YSA9IHdpbmRvdy5tb21lbnQubG9jYWxlRGF0YSgpIGFzIHVua25vd24gYXMge1xuICAgIF93ZWVrOiB7IGRvdzogbnVtYmVyIH07XG4gIH07XG4gIGNvbnN0IHN0YXJ0T2ZXZWVrOiBudW1iZXIgPSBsb2NhbGVEYXRhLl93ZWVrLmRvdztcbiAgcmV0dXJuIGRheXNPZldlZWtbc3RhcnRPZldlZWtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVNYXJrZG93bkxpbmsoXG4gIGFwcDogQXBwLFxuICBzdWJwYXRoOiBzdHJpbmcsXG4gIGFsaWFzPzogc3RyaW5nXG4pOiBzdHJpbmcge1xuICBjb25zdCB1c2VNYXJrZG93bkxpbmtzID0gKFxuICAgIGFwcC52YXVsdCBhcyB1bmtub3duIGFzIHsgZ2V0Q29uZmlnKGtleTogc3RyaW5nKTogYm9vbGVhbiB9XG4gICkuZ2V0Q29uZmlnKFwidXNlTWFya2Rvd25MaW5rc1wiKTtcbiAgY29uc3QgcGF0aCA9IG5vcm1hbGl6ZVBhdGgoc3VicGF0aCk7XG5cbiAgaWYgKHVzZU1hcmtkb3duTGlua3MpIHtcbiAgICBpZiAoYWxpYXMpIHtcbiAgICAgIHJldHVybiBgWyR7YWxpYXN9XSgke3BhdGgucmVwbGFjZSgvIC9nLCBcIiUyMFwiKX0pYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGBbJHtzdWJwYXRofV0oJHtwYXRofSlgO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoYWxpYXMpIHtcbiAgICAgIHJldHVybiBgW1ske3BhdGh9fCR7YWxpYXN9XV1gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYFtbJHtwYXRofV1dYDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERhdGVMaW5rQWxpYXMoXG4gIHBsdWdpbjoge1xuICAgIHNldHRpbmdzOiB7IGRlZmF1bHRBbGlhczogc3RyaW5nIH07XG4gICAgcGFyc2VEYXRlOiAoczogc3RyaW5nKSA9PiB7IG1vbWVudDogbW9tZW50Lk1vbWVudCB9O1xuICB9LFxuICBkYXRlSW5wdXQ6IHN0cmluZyxcbiAgdXNlU3VnZ2VzdGlvbkxhYmVsOiBib29sZWFuXG4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAodXNlU3VnZ2VzdGlvbkxhYmVsKSB7XG4gICAgcmV0dXJuIGRhdGVJbnB1dDtcbiAgfVxuICBpZiAocGx1Z2luLnNldHRpbmdzLmRlZmF1bHRBbGlhcykge1xuICAgIGNvbnN0IHBhcnNlZCA9IHBsdWdpbi5wYXJzZURhdGUoZGF0ZUlucHV0KTtcbiAgICByZXR1cm4gcGFyc2VkLm1vbWVudC5pc1ZhbGlkKClcbiAgICAgID8gcGFyc2VkLm1vbWVudC5mb3JtYXQocGx1Z2luLnNldHRpbmdzLmRlZmF1bHRBbGlhcylcbiAgICAgIDogdW5kZWZpbmVkO1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRPckNyZWF0ZURhaWx5Tm90ZShcbiAgZGF0ZTogbW9tZW50Lk1vbWVudFxuKTogUHJvbWlzZTxURmlsZSB8IG51bGw+IHtcbiAgY29uc3QgZGVzaXJlZE5vdGUgPSBnZXREYWlseU5vdGUoZGF0ZSwgZ2V0QWxsRGFpbHlOb3RlcygpKTtcbiAgaWYgKGRlc2lyZWROb3RlKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShkZXNpcmVkTm90ZSk7XG4gIH1cbiAgcmV0dXJuIGNyZWF0ZURhaWx5Tm90ZShkYXRlKTtcbn1cblxuLy8gLS0tLSDkuK3mlofluo/mlbDor43op6PmnpAgLS0tLVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlWmhPcmRpbmFsKHRleHQ6IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICBjb25zdCBtYXRjaCA9IHRleHQubWF0Y2goL+esrChb5LiA5LqM5LiJ5Zub5LqU5YWt5LiD5YWr5Lmd5Y2B5bu/5Y2FXSspLyk7XG4gIGlmIChtYXRjaCAmJiBaSF9PUkRJTkFMU1ttYXRjaFsxXV0gIT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBaSF9PUkRJTkFMU1ttYXRjaFsxXV07XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG4iLCJpbXBvcnQgeyBBcHAsIE1hcmtkb3duVmlldywgTW9kYWwsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlTWFya2Rvd25MaW5rLCBnZXREYXRlTGlua0FsaWFzIH0gZnJvbSBcInNyYy91dGlsc1wiO1xuaW1wb3J0IHR5cGUgTmF0dXJhbExhbmd1YWdlRGF0ZXMgZnJvbSBcIi4uL21haW5cIjtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGF0ZVBpY2tlck1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBsZXQgcHJldmlld0VsOiBIVE1MRWxlbWVudDtcblxuICAgIGxldCBkYXRlSW5wdXQgPSBcIlwiO1xuICAgIGxldCBtb21lbnRGb3JtYXQgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5tb2RhbE1vbWVudEZvcm1hdDtcbiAgICBsZXQgaW5zZXJ0QXNMaW5rID0gdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kYWxUb2dnbGVMaW5rO1xuXG4gICAgY29uc3QgZ2V0RGF0ZVN0ciA9ICgpID0+IHtcbiAgICAgIGxldCBjbGVhbkRhdGVJbnB1dCA9IGRhdGVJbnB1dDtcbiAgICAgIGxldCBzaG91bGRJbmNsdWRlQWxpYXMgPSBmYWxzZTtcblxuICAgICAgaWYgKGRhdGVJbnB1dC5lbmRzV2l0aChcInxcIikpIHtcbiAgICAgICAgc2hvdWxkSW5jbHVkZUFsaWFzID0gdHJ1ZTtcbiAgICAgICAgY2xlYW5EYXRlSW5wdXQgPSBkYXRlSW5wdXQuc2xpY2UoMCwgLTEpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXJzZWREYXRlID0gdGhpcy5wbHVnaW4ucGFyc2VEYXRlKGNsZWFuRGF0ZUlucHV0IHx8IFwi5LuK5aSpXCIpO1xuICAgICAgbGV0IHBhcnNlZERhdGVTdHJpbmcgPSBwYXJzZWREYXRlLm1vbWVudC5pc1ZhbGlkKClcbiAgICAgICAgPyBwYXJzZWREYXRlLm1vbWVudC5mb3JtYXQobW9tZW50Rm9ybWF0KVxuICAgICAgICA6IFwiXCI7XG5cbiAgICAgIGlmIChpbnNlcnRBc0xpbmspIHtcbiAgICAgICAgY29uc3QgYWxpYXMgPSBnZXREYXRlTGlua0FsaWFzKFxuICAgICAgICAgIHRoaXMucGx1Z2luLFxuICAgICAgICAgIGNsZWFuRGF0ZUlucHV0LFxuICAgICAgICAgIHNob3VsZEluY2x1ZGVBbGlhc1xuICAgICAgICApO1xuICAgICAgICBwYXJzZWREYXRlU3RyaW5nID0gZ2VuZXJhdGVNYXJrZG93bkxpbmsoXG4gICAgICAgICAgdGhpcy5hcHAsXG4gICAgICAgICAgcGFyc2VkRGF0ZVN0cmluZyxcbiAgICAgICAgICBhbGlhc1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyc2VkRGF0ZVN0cmluZztcbiAgICB9O1xuXG4gICAgdGhpcy5jb250ZW50RWwuY3JlYXRlRWwoXCJmb3JtXCIsIHt9LCAoZm9ybUVsKSA9PiB7XG4gICAgICBjb25zdCBkYXRlSW5wdXRFbCA9IG5ldyBTZXR0aW5nKGZvcm1FbClcbiAgICAgICAgLnNldE5hbWUoXCLml6XmnJ9cIilcbiAgICAgICAgLnNldERlc2MoZ2V0RGF0ZVN0cigpKVxuICAgICAgICAuYWRkVGV4dCgodGV4dEVsKSA9PiB7XG4gICAgICAgICAgdGV4dEVsLnNldFBsYWNlaG9sZGVyKFwi5LuK5aSpXCIpO1xuXG4gICAgICAgICAgdGV4dEVsLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgZGF0ZUlucHV0ID0gdmFsdWU7XG4gICAgICAgICAgICBwcmV2aWV3RWwuc2V0VGV4dChnZXREYXRlU3RyKCkpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGV4dEVsLmlucHV0RWwuZm9jdXMoKSwgMTApO1xuICAgICAgICB9KTtcbiAgICAgIHByZXZpZXdFbCA9IGRhdGVJbnB1dEVsLmRlc2NFbDtcblxuICAgICAgbmV3IFNldHRpbmcoZm9ybUVsKVxuICAgICAgICAuc2V0TmFtZShcIuaXpeacn+agvOW8j1wiKVxuICAgICAgICAuc2V0RGVzYyhcIk1vbWVudC5qcyDmoLzlvI/lrZfnrKbkuLJcIilcbiAgICAgICAgLmFkZE1vbWVudEZvcm1hdCgobW9tZW50RWwpID0+IHtcbiAgICAgICAgICBtb21lbnRFbC5zZXRQbGFjZWhvbGRlcihcIui+k+WFpeagvOW8j1wiKTtcbiAgICAgICAgICBtb21lbnRFbC5zZXRWYWx1ZShtb21lbnRGb3JtYXQpO1xuICAgICAgICAgIG1vbWVudEVsLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgbW9tZW50Rm9ybWF0ID0gdmFsdWUudHJpbSgpIHx8IFwiWVlZWS1NTS1ERCBISDptbVwiO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MubW9kYWxNb21lbnRGb3JtYXQgPSBtb21lbnRGb3JtYXQ7XG4gICAgICAgICAgICB2b2lkIHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgICAgcHJldmlld0VsLnNldFRleHQoZ2V0RGF0ZVN0cigpKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgIG5ldyBTZXR0aW5nKGZvcm1FbClcbiAgICAgICAgLnNldE5hbWUoXCLmj5LlhaXkuLrpk77mjqXvvJ9cIilcbiAgICAgICAgLmFkZFRvZ2dsZSgodG9nZ2xlRWwpID0+IHtcbiAgICAgICAgICB0b2dnbGVFbFxuICAgICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLm1vZGFsVG9nZ2xlTGluaylcbiAgICAgICAgICAgIC5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgaW5zZXJ0QXNMaW5rID0gdmFsdWU7XG4gICAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLm1vZGFsVG9nZ2xlTGluayA9IGluc2VydEFzTGluaztcbiAgICAgICAgICAgICAgdm9pZCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgICAgcHJldmlld0VsLnNldFRleHQoZ2V0RGF0ZVN0cigpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgZm9ybUVsLmNyZWF0ZURpdihcIm1vZGFsLWJ1dHRvbi1jb250YWluZXJcIiwgKGJ1dHRvbkNvbnRhaW5lckVsKSA9PiB7XG4gICAgICAgIGJ1dHRvbkNvbnRhaW5lckVsXG4gICAgICAgICAgLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcbiAgICAgICAgICAgIGF0dHI6IHsgdHlwZTogXCJidXR0b25cIiB9LFxuICAgICAgICAgICAgdGV4dDogXCLlj5bmtohcIixcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5jbG9zZSgpKTtcbiAgICAgICAgYnV0dG9uQ29udGFpbmVyRWwuY3JlYXRlRWwoXCJidXR0b25cIiwge1xuICAgICAgICAgIGF0dHI6IHsgdHlwZTogXCJzdWJtaXRcIiB9LFxuICAgICAgICAgIGNsczogXCJtb2QtY3RhXCIsXG4gICAgICAgICAgdGV4dDogXCLmj5LlhaXml6XmnJ9cIixcbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgYWN0aXZlVmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG4gICAgICBpZiAoYWN0aXZlVmlldykge1xuICAgICAgICBjb25zdCBhY3RpdmVFZGl0b3IgPSBhY3RpdmVWaWV3LmVkaXRvcjtcbiAgICAgICAgZm9ybUVsLmFkZEV2ZW50TGlzdGVuZXIoXCJzdWJtaXRcIiwgKGU6IEV2ZW50KSA9PiB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgICBhY3RpdmVFZGl0b3IucmVwbGFjZVNlbGVjdGlvbihnZXREYXRlU3RyKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIiwiZXhwb3J0IHZhciBNZXJpZGllbTtcbihmdW5jdGlvbiAoTWVyaWRpZW0pIHtcbiAgICBNZXJpZGllbVtNZXJpZGllbVtcIkFNXCJdID0gMF0gPSBcIkFNXCI7XG4gICAgTWVyaWRpZW1bTWVyaWRpZW1bXCJQTVwiXSA9IDFdID0gXCJQTVwiO1xufSkoTWVyaWRpZW0gfHwgKE1lcmlkaWVtID0ge30pKTtcbmV4cG9ydCB2YXIgV2Vla2RheTtcbihmdW5jdGlvbiAoV2Vla2RheSkge1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIlNVTkRBWVwiXSA9IDBdID0gXCJTVU5EQVlcIjtcbiAgICBXZWVrZGF5W1dlZWtkYXlbXCJNT05EQVlcIl0gPSAxXSA9IFwiTU9OREFZXCI7XG4gICAgV2Vla2RheVtXZWVrZGF5W1wiVFVFU0RBWVwiXSA9IDJdID0gXCJUVUVTREFZXCI7XG4gICAgV2Vla2RheVtXZWVrZGF5W1wiV0VETkVTREFZXCJdID0gM10gPSBcIldFRE5FU0RBWVwiO1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIlRIVVJTREFZXCJdID0gNF0gPSBcIlRIVVJTREFZXCI7XG4gICAgV2Vla2RheVtXZWVrZGF5W1wiRlJJREFZXCJdID0gNV0gPSBcIkZSSURBWVwiO1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIlNBVFVSREFZXCJdID0gNl0gPSBcIlNBVFVSREFZXCI7XG59KShXZWVrZGF5IHx8IChXZWVrZGF5ID0ge30pKTtcbmV4cG9ydCB2YXIgTW9udGg7XG4oZnVuY3Rpb24gKE1vbnRoKSB7XG4gICAgTW9udGhbTW9udGhbXCJKQU5VQVJZXCJdID0gMV0gPSBcIkpBTlVBUllcIjtcbiAgICBNb250aFtNb250aFtcIkZFQlJVQVJZXCJdID0gMl0gPSBcIkZFQlJVQVJZXCI7XG4gICAgTW9udGhbTW9udGhbXCJNQVJDSFwiXSA9IDNdID0gXCJNQVJDSFwiO1xuICAgIE1vbnRoW01vbnRoW1wiQVBSSUxcIl0gPSA0XSA9IFwiQVBSSUxcIjtcbiAgICBNb250aFtNb250aFtcIk1BWVwiXSA9IDVdID0gXCJNQVlcIjtcbiAgICBNb250aFtNb250aFtcIkpVTkVcIl0gPSA2XSA9IFwiSlVORVwiO1xuICAgIE1vbnRoW01vbnRoW1wiSlVMWVwiXSA9IDddID0gXCJKVUxZXCI7XG4gICAgTW9udGhbTW9udGhbXCJBVUdVU1RcIl0gPSA4XSA9IFwiQVVHVVNUXCI7XG4gICAgTW9udGhbTW9udGhbXCJTRVBURU1CRVJcIl0gPSA5XSA9IFwiU0VQVEVNQkVSXCI7XG4gICAgTW9udGhbTW9udGhbXCJPQ1RPQkVSXCJdID0gMTBdID0gXCJPQ1RPQkVSXCI7XG4gICAgTW9udGhbTW9udGhbXCJOT1ZFTUJFUlwiXSA9IDExXSA9IFwiTk9WRU1CRVJcIjtcbiAgICBNb250aFtNb250aFtcIkRFQ0VNQkVSXCJdID0gMTJdID0gXCJERUNFTUJFUlwiO1xufSkoTW9udGggfHwgKE1vbnRoID0ge30pKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXR5cGVzLmpzLm1hcCIsImltcG9ydCB7IE1lcmlkaWVtIH0gZnJvbSBcIi4uL3R5cGVzLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50LCB0YXJnZXQpIHtcbiAgICBjb21wb25lbnQuYXNzaWduKFwiZGF5XCIsIHRhcmdldC5nZXREYXRlKCkpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJtb250aFwiLCB0YXJnZXQuZ2V0TW9udGgoKSArIDEpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJ5ZWFyXCIsIHRhcmdldC5nZXRGdWxsWWVhcigpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBhc3NpZ25TaW1pbGFyVGltZShjb21wb25lbnQsIHRhcmdldCkge1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJob3VyXCIsIHRhcmdldC5nZXRIb3VycygpKTtcbiAgICBjb21wb25lbnQuYXNzaWduKFwibWludXRlXCIsIHRhcmdldC5nZXRNaW51dGVzKCkpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJzZWNvbmRcIiwgdGFyZ2V0LmdldFNlY29uZHMoKSk7XG4gICAgY29tcG9uZW50LmFzc2lnbihcIm1pbGxpc2Vjb25kXCIsIHRhcmdldC5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgY29tcG9uZW50LmFzc2lnbihcIm1lcmlkaWVtXCIsIHRhcmdldC5nZXRIb3VycygpIDwgMTIgPyBNZXJpZGllbS5BTSA6IE1lcmlkaWVtLlBNKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpbXBseVNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0KSB7XG4gICAgY29tcG9uZW50LmltcGx5KFwiZGF5XCIsIHRhcmdldC5nZXREYXRlKCkpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1vbnRoXCIsIHRhcmdldC5nZXRNb250aCgpICsgMSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwieWVhclwiLCB0YXJnZXQuZ2V0RnVsbFllYXIoKSk7XG59XG5leHBvcnQgZnVuY3Rpb24gaW1wbHlTaW1pbGFyVGltZShjb21wb25lbnQsIHRhcmdldCkge1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgdGFyZ2V0LmdldEhvdXJzKCkpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbnV0ZVwiLCB0YXJnZXQuZ2V0TWludXRlcygpKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJzZWNvbmRcIiwgdGFyZ2V0LmdldFNlY29uZHMoKSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgdGFyZ2V0LmdldE1pbGxpc2Vjb25kcygpKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCB0YXJnZXQuZ2V0SG91cnMoKSA8IDEyID8gTWVyaWRpZW0uQU0gOiBNZXJpZGllbS5QTSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRlcy5qcy5tYXAiLCJpbXBvcnQgeyBXZWVrZGF5LCBNb250aCB9IGZyb20gXCIuL3R5cGVzLmpzXCI7XG5leHBvcnQgY29uc3QgVElNRVpPTkVfQUJCUl9NQVAgPSB7XG4gICAgQUNEVDogNjMwLFxuICAgIEFDU1Q6IDU3MCxcbiAgICBBRFQ6IC0xODAsXG4gICAgQUVEVDogNjYwLFxuICAgIEFFU1Q6IDYwMCxcbiAgICBBRlQ6IDI3MCxcbiAgICBBS0RUOiAtNDgwLFxuICAgIEFLU1Q6IC01NDAsXG4gICAgQUxNVDogMzYwLFxuICAgIEFNU1Q6IC0xODAsXG4gICAgQU1UOiAtMjQwLFxuICAgIEFOQVNUOiA3MjAsXG4gICAgQU5BVDogNzIwLFxuICAgIEFRVFQ6IDMwMCxcbiAgICBBUlQ6IC0xODAsXG4gICAgQVNUOiAtMjQwLFxuICAgIEFXRFQ6IDU0MCxcbiAgICBBV1NUOiA0ODAsXG4gICAgQVpPU1Q6IDAsXG4gICAgQVpPVDogLTYwLFxuICAgIEFaU1Q6IDMwMCxcbiAgICBBWlQ6IDI0MCxcbiAgICBCTlQ6IDQ4MCxcbiAgICBCT1Q6IC0yNDAsXG4gICAgQlJTVDogLTEyMCxcbiAgICBCUlQ6IC0xODAsXG4gICAgQlNUOiA2MCxcbiAgICBCVFQ6IDM2MCxcbiAgICBDQVNUOiA0ODAsXG4gICAgQ0FUOiAxMjAsXG4gICAgQ0NUOiAzOTAsXG4gICAgQ0RUOiAtMzAwLFxuICAgIENFU1Q6IDEyMCxcbiAgICBDRVQ6IHtcbiAgICAgICAgdGltZXpvbmVPZmZzZXREdXJpbmdEc3Q6IDIgKiA2MCxcbiAgICAgICAgdGltZXpvbmVPZmZzZXROb25Ec3Q6IDYwLFxuICAgICAgICBkc3RTdGFydDogKHllYXIpID0+IGdldExhc3RXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXRMYXN0V2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguT0NUT0JFUiwgV2Vla2RheS5TVU5EQVksIDMpLFxuICAgIH0sXG4gICAgQ0hBRFQ6IDgyNSxcbiAgICBDSEFTVDogNzY1LFxuICAgIENLVDogLTYwMCxcbiAgICBDTFNUOiAtMTgwLFxuICAgIENMVDogLTI0MCxcbiAgICBDT1Q6IC0zMDAsXG4gICAgQ1NUOiAtMzYwLFxuICAgIENUOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNSAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTYgKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgQ1ZUOiAtNjAsXG4gICAgQ1hUOiA0MjAsXG4gICAgQ2hTVDogNjAwLFxuICAgIERBVlQ6IDQyMCxcbiAgICBFQVNTVDogLTMwMCxcbiAgICBFQVNUOiAtMzYwLFxuICAgIEVBVDogMTgwLFxuICAgIEVDVDogLTMwMCxcbiAgICBFRFQ6IC0yNDAsXG4gICAgRUVTVDogMTgwLFxuICAgIEVFVDogMTIwLFxuICAgIEVHU1Q6IDAsXG4gICAgRUdUOiAtNjAsXG4gICAgRVNUOiAtMzAwLFxuICAgIEVUOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNCAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTUgKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgRkpTVDogNzgwLFxuICAgIEZKVDogNzIwLFxuICAgIEZLU1Q6IC0xODAsXG4gICAgRktUOiAtMjQwLFxuICAgIEZOVDogLTEyMCxcbiAgICBHQUxUOiAtMzYwLFxuICAgIEdBTVQ6IC01NDAsXG4gICAgR0VUOiAyNDAsXG4gICAgR0ZUOiAtMTgwLFxuICAgIEdJTFQ6IDcyMCxcbiAgICBHTVQ6IDAsXG4gICAgR1NUOiAyNDAsXG4gICAgR1lUOiAtMjQwLFxuICAgIEhBQTogLTE4MCxcbiAgICBIQUM6IC0zMDAsXG4gICAgSEFEVDogLTU0MCxcbiAgICBIQUU6IC0yNDAsXG4gICAgSEFQOiAtNDIwLFxuICAgIEhBUjogLTM2MCxcbiAgICBIQVNUOiAtNjAwLFxuICAgIEhBVDogLTkwLFxuICAgIEhBWTogLTQ4MCxcbiAgICBIS1Q6IDQ4MCxcbiAgICBITFY6IC0yMTAsXG4gICAgSE5BOiAtMjQwLFxuICAgIEhOQzogLTM2MCxcbiAgICBITkU6IC0zMDAsXG4gICAgSE5QOiAtNDgwLFxuICAgIEhOUjogLTQyMCxcbiAgICBITlQ6IC0xNTAsXG4gICAgSE5ZOiAtNTQwLFxuICAgIEhPVlQ6IDQyMCxcbiAgICBJQ1Q6IDQyMCxcbiAgICBJRFQ6IDE4MCxcbiAgICBJT1Q6IDM2MCxcbiAgICBJUkRUOiAyNzAsXG4gICAgSVJLU1Q6IDU0MCxcbiAgICBJUktUOiA1NDAsXG4gICAgSVJTVDogMjEwLFxuICAgIElTVDogMzMwLFxuICAgIEpTVDogNTQwLFxuICAgIEtHVDogMzYwLFxuICAgIEtSQVNUOiA0ODAsXG4gICAgS1JBVDogNDgwLFxuICAgIEtTVDogNTQwLFxuICAgIEtVWVQ6IDI0MCxcbiAgICBMSERUOiA2NjAsXG4gICAgTEhTVDogNjMwLFxuICAgIExJTlQ6IDg0MCxcbiAgICBNQUdTVDogNzIwLFxuICAgIE1BR1Q6IDcyMCxcbiAgICBNQVJUOiAtNTEwLFxuICAgIE1BV1Q6IDMwMCxcbiAgICBNRFQ6IC0zNjAsXG4gICAgTUVTWjogMTIwLFxuICAgIE1FWjogNjAsXG4gICAgTUhUOiA3MjAsXG4gICAgTU1UOiAzOTAsXG4gICAgTVNEOiAyNDAsXG4gICAgTVNLOiAxODAsXG4gICAgTVNUOiAtNDIwLFxuICAgIE1UOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNiAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTcgKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgTVVUOiAyNDAsXG4gICAgTVZUOiAzMDAsXG4gICAgTVlUOiA0ODAsXG4gICAgTkNUOiA2NjAsXG4gICAgTkRUOiAtOTAsXG4gICAgTkZUOiA2OTAsXG4gICAgTk9WU1Q6IDQyMCxcbiAgICBOT1ZUOiAzNjAsXG4gICAgTlBUOiAzNDUsXG4gICAgTlNUOiAtMTUwLFxuICAgIE5VVDogLTY2MCxcbiAgICBOWkRUOiA3ODAsXG4gICAgTlpTVDogNzIwLFxuICAgIE9NU1NUOiA0MjAsXG4gICAgT01TVDogNDIwLFxuICAgIFBEVDogLTQyMCxcbiAgICBQRVQ6IC0zMDAsXG4gICAgUEVUU1Q6IDcyMCxcbiAgICBQRVRUOiA3MjAsXG4gICAgUEdUOiA2MDAsXG4gICAgUEhPVDogNzgwLFxuICAgIFBIVDogNDgwLFxuICAgIFBLVDogMzAwLFxuICAgIFBNRFQ6IC0xMjAsXG4gICAgUE1TVDogLTE4MCxcbiAgICBQT05UOiA2NjAsXG4gICAgUFNUOiAtNDgwLFxuICAgIFBUOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAtNyAqIDYwLFxuICAgICAgICB0aW1lem9uZU9mZnNldE5vbkRzdDogLTggKiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5NQVJDSCwgV2Vla2RheS5TVU5EQVksIDIsIDIpLFxuICAgICAgICBkc3RFbmQ6ICh5ZWFyKSA9PiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBNb250aC5OT1ZFTUJFUiwgV2Vla2RheS5TVU5EQVksIDEsIDIpLFxuICAgIH0sXG4gICAgUFdUOiA1NDAsXG4gICAgUFlTVDogLTE4MCxcbiAgICBQWVQ6IC0yNDAsXG4gICAgUkVUOiAyNDAsXG4gICAgU0FNVDogMjQwLFxuICAgIFNBU1Q6IDEyMCxcbiAgICBTQlQ6IDY2MCxcbiAgICBTQ1Q6IDI0MCxcbiAgICBTR1Q6IDQ4MCxcbiAgICBTUlQ6IC0xODAsXG4gICAgU1NUOiAtNjYwLFxuICAgIFRBSFQ6IC02MDAsXG4gICAgVEZUOiAzMDAsXG4gICAgVEpUOiAzMDAsXG4gICAgVEtUOiA3ODAsXG4gICAgVExUOiA1NDAsXG4gICAgVE1UOiAzMDAsXG4gICAgVFZUOiA3MjAsXG4gICAgVUxBVDogNDgwLFxuICAgIFVUQzogMCxcbiAgICBVWVNUOiAtMTIwLFxuICAgIFVZVDogLTE4MCxcbiAgICBVWlQ6IDMwMCxcbiAgICBWRVQ6IC0yMTAsXG4gICAgVkxBU1Q6IDY2MCxcbiAgICBWTEFUOiA2NjAsXG4gICAgVlVUOiA2NjAsXG4gICAgV0FTVDogMTIwLFxuICAgIFdBVDogNjAsXG4gICAgV0VTVDogNjAsXG4gICAgV0VTWjogNjAsXG4gICAgV0VUOiAwLFxuICAgIFdFWjogMCxcbiAgICBXRlQ6IDcyMCxcbiAgICBXR1NUOiAtMTIwLFxuICAgIFdHVDogLTE4MCxcbiAgICBXSUI6IDQyMCxcbiAgICBXSVQ6IDU0MCxcbiAgICBXSVRBOiA0ODAsXG4gICAgV1NUOiA3ODAsXG4gICAgV1Q6IDAsXG4gICAgWUFLU1Q6IDYwMCxcbiAgICBZQUtUOiA2MDAsXG4gICAgWUFQVDogNjAwLFxuICAgIFlFS1NUOiAzNjAsXG4gICAgWUVLVDogMzYwLFxufTtcbmV4cG9ydCBmdW5jdGlvbiBnZXROdGhXZWVrZGF5T2ZNb250aCh5ZWFyLCBtb250aCwgd2Vla2RheSwgbiwgaG91ciA9IDApIHtcbiAgICBsZXQgZGF5T2ZNb250aCA9IDA7XG4gICAgbGV0IGkgPSAwO1xuICAgIHdoaWxlIChpIDwgbikge1xuICAgICAgICBkYXlPZk1vbnRoKys7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCAtIDEsIGRheU9mTW9udGgpO1xuICAgICAgICBpZiAoZGF0ZS5nZXREYXkoKSA9PT0gd2Vla2RheSlcbiAgICAgICAgICAgIGkrKztcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEYXRlKHllYXIsIG1vbnRoIC0gMSwgZGF5T2ZNb250aCwgaG91cik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFzdFdlZWtkYXlPZk1vbnRoKHllYXIsIG1vbnRoLCB3ZWVrZGF5LCBob3VyID0gMCkge1xuICAgIGNvbnN0IG9uZUluZGV4ZWRXZWVrZGF5ID0gd2Vla2RheSA9PT0gMCA/IDcgOiB3ZWVrZGF5O1xuICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCAtIDEgKyAxLCAxLCAxMik7XG4gICAgY29uc3QgZmlyc3RXZWVrZGF5TmV4dE1vbnRoID0gZGF0ZS5nZXREYXkoKSA9PT0gMCA/IDcgOiBkYXRlLmdldERheSgpO1xuICAgIGxldCBkYXlEaWZmO1xuICAgIGlmIChmaXJzdFdlZWtkYXlOZXh0TW9udGggPT09IG9uZUluZGV4ZWRXZWVrZGF5KVxuICAgICAgICBkYXlEaWZmID0gNztcbiAgICBlbHNlIGlmIChmaXJzdFdlZWtkYXlOZXh0TW9udGggPCBvbmVJbmRleGVkV2Vla2RheSlcbiAgICAgICAgZGF5RGlmZiA9IDcgKyBmaXJzdFdlZWtkYXlOZXh0TW9udGggLSBvbmVJbmRleGVkV2Vla2RheTtcbiAgICBlbHNlXG4gICAgICAgIGRheURpZmYgPSBmaXJzdFdlZWtkYXlOZXh0TW9udGggLSBvbmVJbmRleGVkV2Vla2RheTtcbiAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSBkYXlEaWZmKTtcbiAgICByZXR1cm4gbmV3IERhdGUoeWVhciwgbW9udGggLSAxLCBkYXRlLmdldERhdGUoKSwgaG91cik7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9UaW1lem9uZU9mZnNldCh0aW1lem9uZUlucHV0LCBkYXRlLCB0aW1lem9uZU92ZXJyaWRlcyA9IHt9KSB7XG4gICAgaWYgKHRpbWV6b25lSW5wdXQgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB0aW1lem9uZUlucHV0ID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHJldHVybiB0aW1lem9uZUlucHV0O1xuICAgIH1cbiAgICBjb25zdCBtYXRjaGVkVGltZXpvbmUgPSB0aW1lem9uZU92ZXJyaWRlc1t0aW1lem9uZUlucHV0XSA/PyBUSU1FWk9ORV9BQkJSX01BUFt0aW1lem9uZUlucHV0XTtcbiAgICBpZiAobWF0Y2hlZFRpbWV6b25lID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbWF0Y2hlZFRpbWV6b25lID09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgcmV0dXJuIG1hdGNoZWRUaW1lem9uZTtcbiAgICB9XG4gICAgaWYgKGRhdGUgPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKGRhdGUgPiBtYXRjaGVkVGltZXpvbmUuZHN0U3RhcnQoZGF0ZS5nZXRGdWxsWWVhcigpKSAmJiAhKGRhdGUgPiBtYXRjaGVkVGltZXpvbmUuZHN0RW5kKGRhdGUuZ2V0RnVsbFllYXIoKSkpKSB7XG4gICAgICAgIHJldHVybiBtYXRjaGVkVGltZXpvbmUudGltZXpvbmVPZmZzZXREdXJpbmdEc3Q7XG4gICAgfVxuICAgIHJldHVybiBtYXRjaGVkVGltZXpvbmUudGltZXpvbmVPZmZzZXROb25Ec3Q7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD10aW1lem9uZS5qcy5tYXAiLCJleHBvcnQgY29uc3QgRW1wdHlEdXJhdGlvbiA9IHtcbiAgICBkYXk6IDAsXG4gICAgc2Vjb25kOiAwLFxuICAgIG1pbGxpc2Vjb25kOiAwLFxufTtcbmV4cG9ydCBmdW5jdGlvbiBhZGREdXJhdGlvbihyZWYsIGR1cmF0aW9uKSB7XG4gICAgbGV0IGRhdGUgPSBuZXcgRGF0ZShyZWYpO1xuICAgIGlmIChkdXJhdGlvbltcInlcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJ5ZWFyXCJdID0gZHVyYXRpb25bXCJ5XCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJ5XCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJtb1wiXSkge1xuICAgICAgICBkdXJhdGlvbltcIm1vbnRoXCJdID0gZHVyYXRpb25bXCJtb1wiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wibW9cIl07XG4gICAgfVxuICAgIGlmIChkdXJhdGlvbltcIk1cIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJtb250aFwiXSA9IGR1cmF0aW9uW1wiTVwiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wiTVwiXTtcbiAgICB9XG4gICAgaWYgKGR1cmF0aW9uW1wid1wiXSkge1xuICAgICAgICBkdXJhdGlvbltcIndlZWtcIl0gPSBkdXJhdGlvbltcIndcIl07XG4gICAgICAgIGRlbGV0ZSBkdXJhdGlvbltcIndcIl07XG4gICAgfVxuICAgIGlmIChkdXJhdGlvbltcImRcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJkYXlcIl0gPSBkdXJhdGlvbltcImRcIl07XG4gICAgICAgIGRlbGV0ZSBkdXJhdGlvbltcImRcIl07XG4gICAgfVxuICAgIGlmIChkdXJhdGlvbltcImhcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJob3VyXCJdID0gZHVyYXRpb25bXCJoXCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJoXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJtXCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wibWludXRlXCJdID0gZHVyYXRpb25bXCJtXCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJtXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJzXCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wic2Vjb25kXCJdID0gZHVyYXRpb25bXCJzXCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJzXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJtc1wiXSkge1xuICAgICAgICBkdXJhdGlvbltcIm1pbGxpc2Vjb25kXCJdID0gZHVyYXRpb25bXCJtc1wiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wibXNcIl07XG4gICAgfVxuICAgIGlmIChcInllYXJcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJ5ZWFyXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRGdWxsWWVhcihkYXRlLmdldEZ1bGxZZWFyKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJ5ZWFyXCJdIC0gZmxvb3I7XG4gICAgICAgIGlmIChyZW1haW5pbmdGcmFjdGlvbiA+IDApIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLm1vbnRoID0gZHVyYXRpb24/Lm1vbnRoID8/IDA7XG4gICAgICAgICAgICBkdXJhdGlvbi5tb250aCArPSByZW1haW5pbmdGcmFjdGlvbiAqIDEyO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcInF1YXJ0ZXJcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJxdWFydGVyXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRNb250aChkYXRlLmdldE1vbnRoKCkgKyBmbG9vciAqIDMpO1xuICAgIH1cbiAgICBpZiAoXCJtb250aFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcIm1vbnRoXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRNb250aChkYXRlLmdldE1vbnRoKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJtb250aFwiXSAtIGZsb29yO1xuICAgICAgICBpZiAocmVtYWluaW5nRnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi53ZWVrID0gZHVyYXRpb24/LndlZWsgPz8gMDtcbiAgICAgICAgICAgIGR1cmF0aW9uLndlZWsgKz0gcmVtYWluaW5nRnJhY3Rpb24gKiA0O1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcIndlZWtcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJ3ZWVrXCJdKTtcbiAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgZmxvb3IgKiA3KTtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nRnJhY3Rpb24gPSBkdXJhdGlvbltcIndlZWtcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24uZGF5ID0gZHVyYXRpb24/LmRheSA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24uZGF5ICs9IE1hdGgucm91bmQocmVtYWluaW5nRnJhY3Rpb24gKiA3KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXCJkYXlcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJkYXlcIl0pO1xuICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJkYXlcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24uaG91ciA9IGR1cmF0aW9uPy5ob3VyID8/IDA7XG4gICAgICAgICAgICBkdXJhdGlvbi5ob3VyICs9IE1hdGgucm91bmQocmVtYWluaW5nRnJhY3Rpb24gKiAyNCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKFwiaG91clwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcImhvdXJcIl0pO1xuICAgICAgICBkYXRlLnNldEhvdXJzKGRhdGUuZ2V0SG91cnMoKSArIGZsb29yKTtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nRnJhY3Rpb24gPSBkdXJhdGlvbltcImhvdXJcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24ubWludXRlID0gZHVyYXRpb24/Lm1pbnV0ZSA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24ubWludXRlICs9IE1hdGgucm91bmQocmVtYWluaW5nRnJhY3Rpb24gKiA2MCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKFwibWludXRlXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wibWludXRlXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRNaW51dGVzKGRhdGUuZ2V0TWludXRlcygpICsgZmxvb3IpO1xuICAgICAgICBjb25zdCByZW1haW5pbmdGcmFjdGlvbiA9IGR1cmF0aW9uW1wibWludXRlXCJdIC0gZmxvb3I7XG4gICAgICAgIGlmIChyZW1haW5pbmdGcmFjdGlvbiA+IDApIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLnNlY29uZCA9IGR1cmF0aW9uPy5zZWNvbmQgPz8gMDtcbiAgICAgICAgICAgIGR1cmF0aW9uLnNlY29uZCArPSBNYXRoLnJvdW5kKHJlbWFpbmluZ0ZyYWN0aW9uICogNjApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcInNlY29uZFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcInNlY29uZFwiXSk7XG4gICAgICAgIGRhdGUuc2V0U2Vjb25kcyhkYXRlLmdldFNlY29uZHMoKSArIGZsb29yKTtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nRnJhY3Rpb24gPSBkdXJhdGlvbltcInNlY29uZFwiXSAtIGZsb29yO1xuICAgICAgICBpZiAocmVtYWluaW5nRnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi5taWxsaXNlY29uZCA9IGR1cmF0aW9uPy5taWxsaXNlY29uZCA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24ubWlsbGlzZWNvbmQgKz0gTWF0aC5yb3VuZChyZW1haW5pbmdGcmFjdGlvbiAqIDEwMDApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcIm1pbGxpc2Vjb25kXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wibWlsbGlzZWNvbmRcIl0pO1xuICAgICAgICBkYXRlLnNldE1pbGxpc2Vjb25kcyhkYXRlLmdldE1pbGxpc2Vjb25kcygpICsgZmxvb3IpO1xuICAgIH1cbiAgICByZXR1cm4gZGF0ZTtcbn1cbmV4cG9ydCBmdW5jdGlvbiByZXZlcnNlRHVyYXRpb24oZHVyYXRpb24pIHtcbiAgICBjb25zdCByZXZlcnNlZCA9IHt9O1xuICAgIGZvciAoY29uc3Qga2V5IGluIGR1cmF0aW9uKSB7XG4gICAgICAgIHJldmVyc2VkW2tleV0gPSAtZHVyYXRpb25ba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIHJldmVyc2VkO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZHVyYXRpb24uanMubWFwIiwiaW1wb3J0IHsgYXNzaWduU2ltaWxhckRhdGUsIGFzc2lnblNpbWlsYXJUaW1lLCBpbXBseVNpbWlsYXJUaW1lIH0gZnJvbSBcIi4vdXRpbHMvZGF0ZXMuanNcIjtcbmltcG9ydCB7IHRvVGltZXpvbmVPZmZzZXQgfSBmcm9tIFwiLi90aW1lem9uZS5qc1wiO1xuaW1wb3J0IHsgYWRkRHVyYXRpb24sIEVtcHR5RHVyYXRpb24gfSBmcm9tIFwiLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuZXhwb3J0IGNsYXNzIFJlZmVyZW5jZVdpdGhUaW1lem9uZSB7XG4gICAgaW5zdGFudDtcbiAgICB0aW1lem9uZU9mZnNldDtcbiAgICBjb25zdHJ1Y3RvcihpbnN0YW50LCB0aW1lem9uZU9mZnNldCkge1xuICAgICAgICB0aGlzLmluc3RhbnQgPSBpbnN0YW50ID8/IG5ldyBEYXRlKCk7XG4gICAgICAgIHRoaXMudGltZXpvbmVPZmZzZXQgPSB0aW1lem9uZU9mZnNldCA/PyBudWxsO1xuICAgIH1cbiAgICBzdGF0aWMgZnJvbURhdGUoZGF0ZSkge1xuICAgICAgICByZXR1cm4gbmV3IFJlZmVyZW5jZVdpdGhUaW1lem9uZShkYXRlKTtcbiAgICB9XG4gICAgc3RhdGljIGZyb21JbnB1dChpbnB1dCwgdGltZXpvbmVPdmVycmlkZXMpIHtcbiAgICAgICAgaWYgKGlucHV0IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIFJlZmVyZW5jZVdpdGhUaW1lem9uZS5mcm9tRGF0ZShpbnB1dCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaW5zdGFudCA9IGlucHV0Py5pbnN0YW50ID8/IG5ldyBEYXRlKCk7XG4gICAgICAgIGNvbnN0IHRpbWV6b25lT2Zmc2V0ID0gdG9UaW1lem9uZU9mZnNldChpbnB1dD8udGltZXpvbmUsIGluc3RhbnQsIHRpbWV6b25lT3ZlcnJpZGVzKTtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWZlcmVuY2VXaXRoVGltZXpvbmUoaW5zdGFudCwgdGltZXpvbmVPZmZzZXQpO1xuICAgIH1cbiAgICBnZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKSB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSh0aGlzLmluc3RhbnQpO1xuICAgICAgICBpZiAodGhpcy50aW1lem9uZU9mZnNldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZGF0ZS5zZXRNaW51dGVzKGRhdGUuZ2V0TWludXRlcygpIC0gdGhpcy5nZXRTeXN0ZW1UaW1lem9uZUFkanVzdG1lbnRNaW51dGUodGhpcy5pbnN0YW50KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfVxuICAgIGdldFN5c3RlbVRpbWV6b25lQWRqdXN0bWVudE1pbnV0ZShkYXRlLCBvdmVycmlkZVRpbWV6b25lT2Zmc2V0KSB7XG4gICAgICAgIGlmICghZGF0ZSkge1xuICAgICAgICAgICAgZGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY3VycmVudFRpbWV6b25lT2Zmc2V0ID0gLWRhdGUuZ2V0VGltZXpvbmVPZmZzZXQoKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0VGltZXpvbmVPZmZzZXQgPSBvdmVycmlkZVRpbWV6b25lT2Zmc2V0ID8/IHRoaXMudGltZXpvbmVPZmZzZXQgPz8gY3VycmVudFRpbWV6b25lT2Zmc2V0O1xuICAgICAgICByZXR1cm4gY3VycmVudFRpbWV6b25lT2Zmc2V0IC0gdGFyZ2V0VGltZXpvbmVPZmZzZXQ7XG4gICAgfVxuICAgIGdldFRpbWV6b25lT2Zmc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy50aW1lem9uZU9mZnNldCA/PyAtdGhpcy5pbnN0YW50LmdldFRpbWV6b25lT2Zmc2V0KCk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFBhcnNpbmdDb21wb25lbnRzIHtcbiAgICBrbm93blZhbHVlcztcbiAgICBpbXBsaWVkVmFsdWVzO1xuICAgIHJlZmVyZW5jZTtcbiAgICBfdGFncyA9IG5ldyBTZXQoKTtcbiAgICBjb25zdHJ1Y3RvcihyZWZlcmVuY2UsIGtub3duQ29tcG9uZW50cykge1xuICAgICAgICB0aGlzLnJlZmVyZW5jZSA9IHJlZmVyZW5jZTtcbiAgICAgICAgdGhpcy5rbm93blZhbHVlcyA9IHt9O1xuICAgICAgICB0aGlzLmltcGxpZWRWYWx1ZXMgPSB7fTtcbiAgICAgICAgaWYgKGtub3duQ29tcG9uZW50cykge1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4ga25vd25Db21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5rbm93blZhbHVlc1trZXldID0ga25vd25Db21wb25lbnRzW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICAgICAgdGhpcy5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgIHRoaXMuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgdGhpcy5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgdGhpcy5pbXBseShcImhvdXJcIiwgMTIpO1xuICAgICAgICB0aGlzLmltcGx5KFwibWludXRlXCIsIDApO1xuICAgICAgICB0aGlzLmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgICAgICB0aGlzLmltcGx5KFwibWlsbGlzZWNvbmRcIiwgMCk7XG4gICAgfVxuICAgIHN0YXRpYyBjcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UocmVmZXJlbmNlLCBkdXJhdGlvbiA9IEVtcHR5RHVyYXRpb24pIHtcbiAgICAgICAgbGV0IGRhdGUgPSBhZGREdXJhdGlvbihyZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCksIGR1cmF0aW9uKTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UpO1xuICAgICAgICBjb21wb25lbnRzLmFkZFRhZyhcInJlc3VsdC9yZWxhdGl2ZURhdGVcIik7XG4gICAgICAgIGlmIChcImhvdXJcIiBpbiBkdXJhdGlvbiB8fCBcIm1pbnV0ZVwiIGluIGR1cmF0aW9uIHx8IFwic2Vjb25kXCIgaW4gZHVyYXRpb24gfHwgXCJtaWxsaXNlY29uZFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFkZFRhZyhcInJlc3VsdC9yZWxhdGl2ZURhdGVBbmRUaW1lXCIpO1xuICAgICAgICAgICAgYXNzaWduU2ltaWxhclRpbWUoY29tcG9uZW50cywgZGF0ZSk7XG4gICAgICAgICAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnRzLCBkYXRlKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwidGltZXpvbmVPZmZzZXRcIiwgcmVmZXJlbmNlLmdldFRpbWV6b25lT2Zmc2V0KCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaW1wbHlTaW1pbGFyVGltZShjb21wb25lbnRzLCBkYXRlKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJ0aW1lem9uZU9mZnNldFwiLCByZWZlcmVuY2UuZ2V0VGltZXpvbmVPZmZzZXQoKSk7XG4gICAgICAgICAgICBpZiAoXCJkYXlcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwid2Vla2RheVwiLCBkYXRlLmdldERheSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKFwid2Vla1wiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIndlZWtkYXlcIiwgZGF0ZS5nZXREYXkoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgICAgICBpZiAoXCJtb250aFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoXCJ5ZWFyXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcG9uZW50cztcbiAgICB9XG4gICAgZ2V0KGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoY29tcG9uZW50IGluIHRoaXMua25vd25WYWx1ZXMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmtub3duVmFsdWVzW2NvbXBvbmVudF07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbXBvbmVudCBpbiB0aGlzLmltcGxpZWRWYWx1ZXMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpZWRWYWx1ZXNbY29tcG9uZW50XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaXNDZXJ0YWluKGNvbXBvbmVudCkge1xuICAgICAgICByZXR1cm4gY29tcG9uZW50IGluIHRoaXMua25vd25WYWx1ZXM7XG4gICAgfVxuICAgIGdldENlcnRhaW5Db21wb25lbnRzKCkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5rbm93blZhbHVlcyk7XG4gICAgfVxuICAgIGltcGx5KGNvbXBvbmVudCwgdmFsdWUpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudCBpbiB0aGlzLmtub3duVmFsdWVzKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmltcGxpZWRWYWx1ZXNbY29tcG9uZW50XSA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgYXNzaWduKGNvbXBvbmVudCwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5rbm93blZhbHVlc1tjb21wb25lbnRdID0gdmFsdWU7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmltcGxpZWRWYWx1ZXNbY29tcG9uZW50XTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGFkZER1cmF0aW9uQXNJbXBsaWVkKGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnREYXRlID0gdGhpcy5kYXRlV2l0aG91dFRpbWV6b25lQWRqdXN0bWVudCgpO1xuICAgICAgICBjb25zdCBkYXRlID0gYWRkRHVyYXRpb24oY3VycmVudERhdGUsIGR1cmF0aW9uKTtcbiAgICAgICAgaWYgKFwiZGF5XCIgaW4gZHVyYXRpb24gfHwgXCJ3ZWVrXCIgaW4gZHVyYXRpb24gfHwgXCJtb250aFwiIGluIGR1cmF0aW9uIHx8IFwieWVhclwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZShbXCJkYXlcIiwgXCJ3ZWVrZGF5XCIsIFwibW9udGhcIiwgXCJ5ZWFyXCJdKTtcbiAgICAgICAgICAgIHRoaXMuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgdGhpcy5pbXBseShcIndlZWtkYXlcIiwgZGF0ZS5nZXREYXkoKSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChcInNlY29uZFwiIGluIGR1cmF0aW9uIHx8IFwibWludXRlXCIgaW4gZHVyYXRpb24gfHwgXCJob3VyXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlKFtcInNlY29uZFwiLCBcIm1pbnV0ZVwiLCBcImhvdXJcIl0pO1xuICAgICAgICAgICAgdGhpcy5pbXBseShcInNlY29uZFwiLCBkYXRlLmdldFNlY29uZHMoKSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwibWludXRlXCIsIGRhdGUuZ2V0TWludXRlcygpKTtcbiAgICAgICAgICAgIHRoaXMuaW1wbHkoXCJob3VyXCIsIGRhdGUuZ2V0SG91cnMoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGRlbGV0ZShjb21wb25lbnRzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50cyA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgICAgY29tcG9uZW50cyA9IFtjb21wb25lbnRzXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudCBvZiBjb21wb25lbnRzKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5rbm93blZhbHVlc1tjb21wb25lbnRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuaW1wbGllZFZhbHVlc1tjb21wb25lbnRdO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHModGhpcy5yZWZlcmVuY2UpO1xuICAgICAgICBjb21wb25lbnQua25vd25WYWx1ZXMgPSB7fTtcbiAgICAgICAgY29tcG9uZW50LmltcGxpZWRWYWx1ZXMgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5rbm93blZhbHVlcykge1xuICAgICAgICAgICAgY29tcG9uZW50Lmtub3duVmFsdWVzW2tleV0gPSB0aGlzLmtub3duVmFsdWVzW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5pbXBsaWVkVmFsdWVzKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuaW1wbGllZFZhbHVlc1trZXldID0gdGhpcy5pbXBsaWVkVmFsdWVzW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG4gICAgaXNPbmx5RGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLmlzQ2VydGFpbihcImhvdXJcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwibWludXRlXCIpICYmICF0aGlzLmlzQ2VydGFpbihcInNlY29uZFwiKTtcbiAgICB9XG4gICAgaXNPbmx5VGltZSgpIHtcbiAgICAgICAgcmV0dXJuICghdGhpcy5pc0NlcnRhaW4oXCJ3ZWVrZGF5XCIpICYmICF0aGlzLmlzQ2VydGFpbihcImRheVwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJtb250aFwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJ5ZWFyXCIpKTtcbiAgICB9XG4gICAgaXNPbmx5V2Vla2RheUNvbXBvbmVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNDZXJ0YWluKFwid2Vla2RheVwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJkYXlcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwibW9udGhcIik7XG4gICAgfVxuICAgIGlzRGF0ZVdpdGhVbmtub3duWWVhcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNDZXJ0YWluKFwibW9udGhcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwieWVhclwiKTtcbiAgICB9XG4gICAgaXNWYWxpZERhdGUoKSB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSB0aGlzLmRhdGVXaXRob3V0VGltZXpvbmVBZGp1c3RtZW50KCk7XG4gICAgICAgIGlmIChkYXRlLmdldEZ1bGxZZWFyKCkgIT09IHRoaXMuZ2V0KFwieWVhclwiKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGRhdGUuZ2V0TW9udGgoKSAhPT0gdGhpcy5nZXQoXCJtb250aFwiKSAtIDEpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChkYXRlLmdldERhdGUoKSAhPT0gdGhpcy5nZXQoXCJkYXlcIikpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLmdldChcImhvdXJcIikgIT0gbnVsbCAmJiBkYXRlLmdldEhvdXJzKCkgIT0gdGhpcy5nZXQoXCJob3VyXCIpKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5nZXQoXCJtaW51dGVcIikgIT0gbnVsbCAmJiBkYXRlLmdldE1pbnV0ZXMoKSAhPSB0aGlzLmdldChcIm1pbnV0ZVwiKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHRvU3RyaW5nKCkge1xuICAgICAgICByZXR1cm4gYFtQYXJzaW5nQ29tcG9uZW50cyB7XG4gICAgICAgICAgICB0YWdzOiAke0pTT04uc3RyaW5naWZ5KEFycmF5LmZyb20odGhpcy5fdGFncykuc29ydCgpKX0sIFxuICAgICAgICAgICAga25vd25WYWx1ZXM6ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5rbm93blZhbHVlcyl9LCBcbiAgICAgICAgICAgIGltcGxpZWRWYWx1ZXM6ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5pbXBsaWVkVmFsdWVzKX19LCBcbiAgICAgICAgICAgIHJlZmVyZW5jZTogJHtKU09OLnN0cmluZ2lmeSh0aGlzLnJlZmVyZW5jZSl9XWA7XG4gICAgfVxuICAgIGRhdGUoKSB7XG4gICAgICAgIGNvbnN0IGRhdGUgPSB0aGlzLmRhdGVXaXRob3V0VGltZXpvbmVBZGp1c3RtZW50KCk7XG4gICAgICAgIGNvbnN0IHRpbWV6b25lQWRqdXN0bWVudCA9IHRoaXMucmVmZXJlbmNlLmdldFN5c3RlbVRpbWV6b25lQWRqdXN0bWVudE1pbnV0ZShkYXRlLCB0aGlzLmdldChcInRpbWV6b25lT2Zmc2V0XCIpKTtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKGRhdGUuZ2V0VGltZSgpICsgdGltZXpvbmVBZGp1c3RtZW50ICogNjAwMDApO1xuICAgIH1cbiAgICBhZGRUYWcodGFnKSB7XG4gICAgICAgIHRoaXMuX3RhZ3MuYWRkKHRhZyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBhZGRUYWdzKHRhZ3MpIHtcbiAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgdGFncykge1xuICAgICAgICAgICAgdGhpcy5fdGFncy5hZGQodGFnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgdGFncygpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBTZXQodGhpcy5fdGFncyk7XG4gICAgfVxuICAgIGRhdGVXaXRob3V0VGltZXpvbmVBZGp1c3RtZW50KCkge1xuICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUodGhpcy5nZXQoXCJ5ZWFyXCIpLCB0aGlzLmdldChcIm1vbnRoXCIpIC0gMSwgdGhpcy5nZXQoXCJkYXlcIiksIHRoaXMuZ2V0KFwiaG91clwiKSwgdGhpcy5nZXQoXCJtaW51dGVcIiksIHRoaXMuZ2V0KFwic2Vjb25kXCIpLCB0aGlzLmdldChcIm1pbGxpc2Vjb25kXCIpKTtcbiAgICAgICAgZGF0ZS5zZXRGdWxsWWVhcih0aGlzLmdldChcInllYXJcIikpO1xuICAgICAgICByZXR1cm4gZGF0ZTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUGFyc2luZ1Jlc3VsdCB7XG4gICAgcmVmRGF0ZTtcbiAgICBpbmRleDtcbiAgICB0ZXh0O1xuICAgIHJlZmVyZW5jZTtcbiAgICBzdGFydDtcbiAgICBlbmQ7XG4gICAgY29uc3RydWN0b3IocmVmZXJlbmNlLCBpbmRleCwgdGV4dCwgc3RhcnQsIGVuZCkge1xuICAgICAgICB0aGlzLnJlZmVyZW5jZSA9IHJlZmVyZW5jZTtcbiAgICAgICAgdGhpcy5yZWZEYXRlID0gcmVmZXJlbmNlLmluc3RhbnQ7XG4gICAgICAgIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgICAgICAgdGhpcy50ZXh0ID0gdGV4dDtcbiAgICAgICAgdGhpcy5zdGFydCA9IHN0YXJ0IHx8IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UpO1xuICAgICAgICB0aGlzLmVuZCA9IGVuZDtcbiAgICB9XG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBQYXJzaW5nUmVzdWx0KHRoaXMucmVmZXJlbmNlLCB0aGlzLmluZGV4LCB0aGlzLnRleHQpO1xuICAgICAgICByZXN1bHQuc3RhcnQgPSB0aGlzLnN0YXJ0ID8gdGhpcy5zdGFydC5jbG9uZSgpIDogbnVsbDtcbiAgICAgICAgcmVzdWx0LmVuZCA9IHRoaXMuZW5kID8gdGhpcy5lbmQuY2xvbmUoKSA6IG51bGw7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGRhdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXJ0LmRhdGUoKTtcbiAgICB9XG4gICAgYWRkVGFnKHRhZykge1xuICAgICAgICB0aGlzLnN0YXJ0LmFkZFRhZyh0YWcpO1xuICAgICAgICBpZiAodGhpcy5lbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5kLmFkZFRhZyh0YWcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBhZGRUYWdzKHRhZ3MpIHtcbiAgICAgICAgdGhpcy5zdGFydC5hZGRUYWdzKHRhZ3MpO1xuICAgICAgICBpZiAodGhpcy5lbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5kLmFkZFRhZ3ModGFncyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHRhZ3MoKSB7XG4gICAgICAgIGNvbnN0IGNvbWJpbmVkVGFncyA9IG5ldyBTZXQodGhpcy5zdGFydC50YWdzKCkpO1xuICAgICAgICBpZiAodGhpcy5lbmQpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRoaXMuZW5kLnRhZ3MoKSkge1xuICAgICAgICAgICAgICAgIGNvbWJpbmVkVGFncy5hZGQodGFnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tYmluZWRUYWdzO1xuICAgIH1cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgY29uc3QgdGFncyA9IEFycmF5LmZyb20odGhpcy50YWdzKCkpLnNvcnQoKTtcbiAgICAgICAgcmV0dXJuIGBbUGFyc2luZ1Jlc3VsdCB7aW5kZXg6ICR7dGhpcy5pbmRleH0sIHRleHQ6ICcke3RoaXMudGV4dH0nLCB0YWdzOiAke0pTT04uc3RyaW5naWZ5KHRhZ3MpfSAuLi59XWA7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cmVzdWx0cy5qcy5tYXAiLCJleHBvcnQgZnVuY3Rpb24gcmVwZWF0ZWRUaW1ldW5pdFBhdHRlcm4ocHJlZml4LCBzaW5nbGVUaW1ldW5pdFBhdHRlcm4sIGNvbm5lY3RvclBhdHRlcm4gPSBcIlxcXFxzezAsNX0sP1xcXFxzezAsNX1cIikge1xuICAgIGNvbnN0IHNpbmdsZVRpbWV1bml0UGF0dGVybk5vQ2FwdHVyZSA9IHNpbmdsZVRpbWV1bml0UGF0dGVybi5yZXBsYWNlKC9cXCgoPyFcXD8pL2csIFwiKD86XCIpO1xuICAgIHJldHVybiBgJHtwcmVmaXh9JHtzaW5nbGVUaW1ldW5pdFBhdHRlcm5Ob0NhcHR1cmV9KD86JHtjb25uZWN0b3JQYXR0ZXJufSR7c2luZ2xlVGltZXVuaXRQYXR0ZXJuTm9DYXB0dXJlfSl7MCwxMH1gO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RUZXJtcyhkaWN0aW9uYXJ5KSB7XG4gICAgbGV0IGtleXM7XG4gICAgaWYgKGRpY3Rpb25hcnkgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBrZXlzID0gWy4uLmRpY3Rpb25hcnldO1xuICAgIH1cbiAgICBlbHNlIGlmIChkaWN0aW9uYXJ5IGluc3RhbmNlb2YgTWFwKSB7XG4gICAgICAgIGtleXMgPSBBcnJheS5mcm9tKGRpY3Rpb25hcnkua2V5cygpKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhkaWN0aW9uYXJ5KTtcbiAgICB9XG4gICAgcmV0dXJuIGtleXM7XG59XG5leHBvcnQgZnVuY3Rpb24gbWF0Y2hBbnlQYXR0ZXJuKGRpY3Rpb25hcnkpIHtcbiAgICBjb25zdCBqb2luZWRUZXJtcyA9IGV4dHJhY3RUZXJtcyhkaWN0aW9uYXJ5KVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aClcbiAgICAgICAgLmpvaW4oXCJ8XCIpXG4gICAgICAgIC5yZXBsYWNlKC9cXC4vZywgXCJcXFxcLlwiKTtcbiAgICByZXR1cm4gYCg/OiR7am9pbmVkVGVybXN9KWA7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYXR0ZXJuLmpzLm1hcCIsImltcG9ydCB7IGFkZER1cmF0aW9uIH0gZnJvbSBcIi4vZHVyYXRpb24uanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBmaW5kTW9zdExpa2VseUFEWWVhcih5ZWFyTnVtYmVyKSB7XG4gICAgaWYgKHllYXJOdW1iZXIgPCAxMDApIHtcbiAgICAgICAgaWYgKHllYXJOdW1iZXIgPiA1MCkge1xuICAgICAgICAgICAgeWVhck51bWJlciA9IHllYXJOdW1iZXIgKyAxOTAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgeWVhck51bWJlciA9IHllYXJOdW1iZXIgKyAyMDAwO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB5ZWFyTnVtYmVyO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRZZWFyQ2xvc2VzdFRvUmVmKHJlZkRhdGUsIGRheSwgbW9udGgpIHtcbiAgICBsZXQgZGF0ZSA9IG5ldyBEYXRlKHJlZkRhdGUpO1xuICAgIGRhdGUuc2V0TW9udGgobW9udGggLSAxKTtcbiAgICBkYXRlLnNldERhdGUoZGF5KTtcbiAgICBjb25zdCBuZXh0WWVhciA9IGFkZER1cmF0aW9uKGRhdGUsIHsgXCJ5ZWFyXCI6IDEgfSk7XG4gICAgY29uc3QgbGFzdFllYXIgPSBhZGREdXJhdGlvbihkYXRlLCB7IFwieWVhclwiOiAtMSB9KTtcbiAgICBpZiAoTWF0aC5hYnMobmV4dFllYXIuZ2V0VGltZSgpIC0gcmVmRGF0ZS5nZXRUaW1lKCkpIDwgTWF0aC5hYnMoZGF0ZS5nZXRUaW1lKCkgLSByZWZEYXRlLmdldFRpbWUoKSkpIHtcbiAgICAgICAgZGF0ZSA9IG5leHRZZWFyO1xuICAgIH1cbiAgICBlbHNlIGlmIChNYXRoLmFicyhsYXN0WWVhci5nZXRUaW1lKCkgLSByZWZEYXRlLmdldFRpbWUoKSkgPCBNYXRoLmFicyhkYXRlLmdldFRpbWUoKSAtIHJlZkRhdGUuZ2V0VGltZSgpKSkge1xuICAgICAgICBkYXRlID0gbGFzdFllYXI7XG4gICAgfVxuICAgIHJldHVybiBkYXRlLmdldEZ1bGxZZWFyKCk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD15ZWFycy5qcy5tYXAiLCJpbXBvcnQgeyBtYXRjaEFueVBhdHRlcm4sIHJlcGVhdGVkVGltZXVuaXRQYXR0ZXJuIH0gZnJvbSBcIi4uLy4uL3V0aWxzL3BhdHRlcm4uanNcIjtcbmltcG9ydCB7IGZpbmRNb3N0TGlrZWx5QURZZWFyIH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5leHBvcnQgY29uc3QgV0VFS0RBWV9ESUNUSU9OQVJZID0ge1xuICAgIHN1bmRheTogMCxcbiAgICBzdW46IDAsXG4gICAgXCJzdW4uXCI6IDAsXG4gICAgbW9uZGF5OiAxLFxuICAgIG1vbjogMSxcbiAgICBcIm1vbi5cIjogMSxcbiAgICB0dWVzZGF5OiAyLFxuICAgIHR1ZTogMixcbiAgICBcInR1ZS5cIjogMixcbiAgICB3ZWRuZXNkYXk6IDMsXG4gICAgd2VkOiAzLFxuICAgIFwid2VkLlwiOiAzLFxuICAgIHRodXJzZGF5OiA0LFxuICAgIHRodXJzOiA0LFxuICAgIFwidGh1cnMuXCI6IDQsXG4gICAgdGh1cjogNCxcbiAgICBcInRodXIuXCI6IDQsXG4gICAgdGh1OiA0LFxuICAgIFwidGh1LlwiOiA0LFxuICAgIGZyaWRheTogNSxcbiAgICBmcmk6IDUsXG4gICAgXCJmcmkuXCI6IDUsXG4gICAgc2F0dXJkYXk6IDYsXG4gICAgc2F0OiA2LFxuICAgIFwic2F0LlwiOiA2LFxufTtcbmV4cG9ydCBjb25zdCBGVUxMX01PTlRIX05BTUVfRElDVElPTkFSWSA9IHtcbiAgICBqYW51YXJ5OiAxLFxuICAgIGZlYnJ1YXJ5OiAyLFxuICAgIG1hcmNoOiAzLFxuICAgIGFwcmlsOiA0LFxuICAgIG1heTogNSxcbiAgICBqdW5lOiA2LFxuICAgIGp1bHk6IDcsXG4gICAgYXVndXN0OiA4LFxuICAgIHNlcHRlbWJlcjogOSxcbiAgICBvY3RvYmVyOiAxMCxcbiAgICBub3ZlbWJlcjogMTEsXG4gICAgZGVjZW1iZXI6IDEyLFxufTtcbmV4cG9ydCBjb25zdCBNT05USF9ESUNUSU9OQVJZID0ge1xuICAgIC4uLkZVTExfTU9OVEhfTkFNRV9ESUNUSU9OQVJZLFxuICAgIGphbjogMSxcbiAgICBcImphbi5cIjogMSxcbiAgICBmZWI6IDIsXG4gICAgXCJmZWIuXCI6IDIsXG4gICAgbWFyOiAzLFxuICAgIFwibWFyLlwiOiAzLFxuICAgIGFwcjogNCxcbiAgICBcImFwci5cIjogNCxcbiAgICBqdW46IDYsXG4gICAgXCJqdW4uXCI6IDYsXG4gICAganVsOiA3LFxuICAgIFwianVsLlwiOiA3LFxuICAgIGF1ZzogOCxcbiAgICBcImF1Zy5cIjogOCxcbiAgICBzZXA6IDksXG4gICAgXCJzZXAuXCI6IDksXG4gICAgc2VwdDogOSxcbiAgICBcInNlcHQuXCI6IDksXG4gICAgb2N0OiAxMCxcbiAgICBcIm9jdC5cIjogMTAsXG4gICAgbm92OiAxMSxcbiAgICBcIm5vdi5cIjogMTEsXG4gICAgZGVjOiAxMixcbiAgICBcImRlYy5cIjogMTIsXG59O1xuZXhwb3J0IGNvbnN0IElOVEVHRVJfV09SRF9ESUNUSU9OQVJZID0ge1xuICAgIG9uZTogMSxcbiAgICB0d286IDIsXG4gICAgdGhyZWU6IDMsXG4gICAgZm91cjogNCxcbiAgICBmaXZlOiA1LFxuICAgIHNpeDogNixcbiAgICBzZXZlbjogNyxcbiAgICBlaWdodDogOCxcbiAgICBuaW5lOiA5LFxuICAgIHRlbjogMTAsXG4gICAgZWxldmVuOiAxMSxcbiAgICB0d2VsdmU6IDEyLFxufTtcbmV4cG9ydCBjb25zdCBPUkRJTkFMX1dPUkRfRElDVElPTkFSWSA9IHtcbiAgICBmaXJzdDogMSxcbiAgICBzZWNvbmQ6IDIsXG4gICAgdGhpcmQ6IDMsXG4gICAgZm91cnRoOiA0LFxuICAgIGZpZnRoOiA1LFxuICAgIHNpeHRoOiA2LFxuICAgIHNldmVudGg6IDcsXG4gICAgZWlnaHRoOiA4LFxuICAgIG5pbnRoOiA5LFxuICAgIHRlbnRoOiAxMCxcbiAgICBlbGV2ZW50aDogMTEsXG4gICAgdHdlbGZ0aDogMTIsXG4gICAgdGhpcnRlZW50aDogMTMsXG4gICAgZm91cnRlZW50aDogMTQsXG4gICAgZmlmdGVlbnRoOiAxNSxcbiAgICBzaXh0ZWVudGg6IDE2LFxuICAgIHNldmVudGVlbnRoOiAxNyxcbiAgICBlaWdodGVlbnRoOiAxOCxcbiAgICBuaW5ldGVlbnRoOiAxOSxcbiAgICB0d2VudGlldGg6IDIwLFxuICAgIFwidHdlbnR5IGZpcnN0XCI6IDIxLFxuICAgIFwidHdlbnR5LWZpcnN0XCI6IDIxLFxuICAgIFwidHdlbnR5IHNlY29uZFwiOiAyMixcbiAgICBcInR3ZW50eS1zZWNvbmRcIjogMjIsXG4gICAgXCJ0d2VudHkgdGhpcmRcIjogMjMsXG4gICAgXCJ0d2VudHktdGhpcmRcIjogMjMsXG4gICAgXCJ0d2VudHkgZm91cnRoXCI6IDI0LFxuICAgIFwidHdlbnR5LWZvdXJ0aFwiOiAyNCxcbiAgICBcInR3ZW50eSBmaWZ0aFwiOiAyNSxcbiAgICBcInR3ZW50eS1maWZ0aFwiOiAyNSxcbiAgICBcInR3ZW50eSBzaXh0aFwiOiAyNixcbiAgICBcInR3ZW50eS1zaXh0aFwiOiAyNixcbiAgICBcInR3ZW50eSBzZXZlbnRoXCI6IDI3LFxuICAgIFwidHdlbnR5LXNldmVudGhcIjogMjcsXG4gICAgXCJ0d2VudHkgZWlnaHRoXCI6IDI4LFxuICAgIFwidHdlbnR5LWVpZ2h0aFwiOiAyOCxcbiAgICBcInR3ZW50eSBuaW50aFwiOiAyOSxcbiAgICBcInR3ZW50eS1uaW50aFwiOiAyOSxcbiAgICBcInRoaXJ0aWV0aFwiOiAzMCxcbiAgICBcInRoaXJ0eSBmaXJzdFwiOiAzMSxcbiAgICBcInRoaXJ0eS1maXJzdFwiOiAzMSxcbn07XG5leHBvcnQgY29uc3QgVElNRV9VTklUX0RJQ1RJT05BUllfTk9fQUJCUiA9IHtcbiAgICBzZWNvbmQ6IFwic2Vjb25kXCIsXG4gICAgc2Vjb25kczogXCJzZWNvbmRcIixcbiAgICBtaW51dGU6IFwibWludXRlXCIsXG4gICAgbWludXRlczogXCJtaW51dGVcIixcbiAgICBob3VyOiBcImhvdXJcIixcbiAgICBob3VyczogXCJob3VyXCIsXG4gICAgZGF5OiBcImRheVwiLFxuICAgIGRheXM6IFwiZGF5XCIsXG4gICAgd2VlazogXCJ3ZWVrXCIsXG4gICAgd2Vla3M6IFwid2Vla1wiLFxuICAgIG1vbnRoOiBcIm1vbnRoXCIsXG4gICAgbW9udGhzOiBcIm1vbnRoXCIsXG4gICAgcXVhcnRlcjogXCJxdWFydGVyXCIsXG4gICAgcXVhcnRlcnM6IFwicXVhcnRlclwiLFxuICAgIHllYXI6IFwieWVhclwiLFxuICAgIHllYXJzOiBcInllYXJcIixcbn07XG5leHBvcnQgY29uc3QgVElNRV9VTklUX0RJQ1RJT05BUlkgPSB7XG4gICAgczogXCJzZWNvbmRcIixcbiAgICBzZWM6IFwic2Vjb25kXCIsXG4gICAgc2Vjb25kOiBcInNlY29uZFwiLFxuICAgIHNlY29uZHM6IFwic2Vjb25kXCIsXG4gICAgbTogXCJtaW51dGVcIixcbiAgICBtaW46IFwibWludXRlXCIsXG4gICAgbWluczogXCJtaW51dGVcIixcbiAgICBtaW51dGU6IFwibWludXRlXCIsXG4gICAgbWludXRlczogXCJtaW51dGVcIixcbiAgICBoOiBcImhvdXJcIixcbiAgICBocjogXCJob3VyXCIsXG4gICAgaHJzOiBcImhvdXJcIixcbiAgICBob3VyOiBcImhvdXJcIixcbiAgICBob3VyczogXCJob3VyXCIsXG4gICAgZDogXCJkYXlcIixcbiAgICBkYXk6IFwiZGF5XCIsXG4gICAgZGF5czogXCJkYXlcIixcbiAgICB3OiBcIndlZWtcIixcbiAgICB3ZWVrOiBcIndlZWtcIixcbiAgICB3ZWVrczogXCJ3ZWVrXCIsXG4gICAgbW86IFwibW9udGhcIixcbiAgICBtb246IFwibW9udGhcIixcbiAgICBtb3M6IFwibW9udGhcIixcbiAgICBtb250aDogXCJtb250aFwiLFxuICAgIG1vbnRoczogXCJtb250aFwiLFxuICAgIHF0cjogXCJxdWFydGVyXCIsXG4gICAgcXVhcnRlcjogXCJxdWFydGVyXCIsXG4gICAgcXVhcnRlcnM6IFwicXVhcnRlclwiLFxuICAgIHk6IFwieWVhclwiLFxuICAgIHlyOiBcInllYXJcIixcbiAgICB5ZWFyOiBcInllYXJcIixcbiAgICB5ZWFyczogXCJ5ZWFyXCIsXG4gICAgLi4uVElNRV9VTklUX0RJQ1RJT05BUllfTk9fQUJCUixcbn07XG5leHBvcnQgY29uc3QgTlVNQkVSX1BBVFRFUk4gPSBgKD86JHttYXRjaEFueVBhdHRlcm4oSU5URUdFUl9XT1JEX0RJQ1RJT05BUlkpfXxbMC05XSt8WzAtOV0rXFxcXC5bMC05XSt8aGFsZig/OlxcXFxzezAsMn1hbj8pP3xhbj9cXFxcYig/OlxcXFxzezAsMn1mZXcpP3xmZXd8c2V2ZXJhbHx0aGV8YT9cXFxcc3swLDJ9Y291cGxlXFxcXHN7MCwyfSg/Om9mKT8pYDtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU51bWJlclBhdHRlcm4obWF0Y2gpIHtcbiAgICBjb25zdCBudW0gPSBtYXRjaC50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChJTlRFR0VSX1dPUkRfRElDVElPTkFSWVtudW1dICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIElOVEVHRVJfV09SRF9ESUNUSU9OQVJZW251bV07XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bSA9PT0gXCJhXCIgfHwgbnVtID09PSBcImFuXCIgfHwgbnVtID09IFwidGhlXCIpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvZmV3LykpIHtcbiAgICAgICAgcmV0dXJuIDM7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvaGFsZi8pKSB7XG4gICAgICAgIHJldHVybiAwLjU7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvY291cGxlLykpIHtcbiAgICAgICAgcmV0dXJuIDI7XG4gICAgfVxuICAgIGVsc2UgaWYgKG51bS5tYXRjaCgvc2V2ZXJhbC8pKSB7XG4gICAgICAgIHJldHVybiA3O1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VGbG9hdChudW0pO1xufVxuZXhwb3J0IGNvbnN0IE9SRElOQUxfTlVNQkVSX1BBVFRFUk4gPSBgKD86JHttYXRjaEFueVBhdHRlcm4oT1JESU5BTF9XT1JEX0RJQ1RJT05BUlkpfXxbMC05XXsxLDJ9KD86c3R8bmR8cmR8dGgpPylgO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlT3JkaW5hbE51bWJlclBhdHRlcm4obWF0Y2gpIHtcbiAgICBsZXQgbnVtID0gbWF0Y2gudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoT1JESU5BTF9XT1JEX0RJQ1RJT05BUllbbnVtXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBPUkRJTkFMX1dPUkRfRElDVElPTkFSWVtudW1dO1xuICAgIH1cbiAgICBudW0gPSBudW0ucmVwbGFjZSgvKD86c3R8bmR8cmR8dGgpJC9pLCBcIlwiKTtcbiAgICByZXR1cm4gcGFyc2VJbnQobnVtKTtcbn1cbmV4cG9ydCBjb25zdCBZRUFSX1BBVFRFUk4gPSBgKD86WzEtOV1bMC05XXswLDN9XFxcXHN7MCwyfSg/OkJFfEFEfEJDfEJDRXxDRSl8WzEtOV1bMC05XXszfXxbNS05XVswLTldfDJbMC01XSlgO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlWWVhcihtYXRjaCkge1xuICAgIGlmICgvQkUvaS50ZXN0KG1hdGNoKSkge1xuICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoL0JFL2ksIFwiXCIpO1xuICAgICAgICByZXR1cm4gcGFyc2VJbnQobWF0Y2gpIC0gNTQzO1xuICAgIH1cbiAgICBpZiAoL0JDRT8vaS50ZXN0KG1hdGNoKSkge1xuICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoL0JDRT8vaSwgXCJcIik7XG4gICAgICAgIHJldHVybiAtcGFyc2VJbnQobWF0Y2gpO1xuICAgIH1cbiAgICBpZiAoLyhBRHxDRSkvaS50ZXN0KG1hdGNoKSkge1xuICAgICAgICBtYXRjaCA9IG1hdGNoLnJlcGxhY2UoLyhBRHxDRSkvaSwgXCJcIik7XG4gICAgICAgIHJldHVybiBwYXJzZUludChtYXRjaCk7XG4gICAgfVxuICAgIGNvbnN0IHJhd1llYXJOdW1iZXIgPSBwYXJzZUludChtYXRjaCk7XG4gICAgcmV0dXJuIGZpbmRNb3N0TGlrZWx5QURZZWFyKHJhd1llYXJOdW1iZXIpO1xufVxuY29uc3QgU0lOR0xFX1RJTUVfVU5JVF9QQVRURVJOID0gYCgke05VTUJFUl9QQVRURVJOfSlcXFxcc3swLDN9KCR7bWF0Y2hBbnlQYXR0ZXJuKFRJTUVfVU5JVF9ESUNUSU9OQVJZKX0pYDtcbmNvbnN0IFNJTkdMRV9USU1FX1VOSVRfUkVHRVggPSBuZXcgUmVnRXhwKFNJTkdMRV9USU1FX1VOSVRfUEFUVEVSTiwgXCJpXCIpO1xuY29uc3QgU0lOR0xFX1RJTUVfVU5JVF9OT19BQkJSX1BBVFRFUk4gPSBgKCR7TlVNQkVSX1BBVFRFUk59KVxcXFxzezAsM30oJHttYXRjaEFueVBhdHRlcm4oVElNRV9VTklUX0RJQ1RJT05BUllfTk9fQUJCUil9KWA7XG5jb25zdCBUSU1FX1VOSVRfQ09OTkVDVE9SX1BBVFRFUk4gPSBgXFxcXHN7MCw1fSw/KD86XFxcXHMqYW5kKT9cXFxcc3swLDV9YDtcbmV4cG9ydCBjb25zdCBUSU1FX1VOSVRTX1BBVFRFUk4gPSByZXBlYXRlZFRpbWV1bml0UGF0dGVybihgKD86KD86YWJvdXR8YXJvdW5kKVxcXFxzezAsM30pP2AsIFNJTkdMRV9USU1FX1VOSVRfUEFUVEVSTiwgVElNRV9VTklUX0NPTk5FQ1RPUl9QQVRURVJOKTtcbmV4cG9ydCBjb25zdCBUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTiA9IHJlcGVhdGVkVGltZXVuaXRQYXR0ZXJuKGAoPzooPzphYm91dHxhcm91bmQpXFxcXHN7MCwzfSk/YCwgU0lOR0xFX1RJTUVfVU5JVF9OT19BQkJSX1BBVFRFUk4sIFRJTUVfVU5JVF9DT05ORUNUT1JfUEFUVEVSTik7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VEdXJhdGlvbih0aW1ldW5pdFRleHQpIHtcbiAgICBjb25zdCBmcmFnbWVudHMgPSB7fTtcbiAgICBsZXQgcmVtYWluaW5nVGV4dCA9IHRpbWV1bml0VGV4dDtcbiAgICBsZXQgbWF0Y2ggPSBTSU5HTEVfVElNRV9VTklUX1JFR0VYLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgd2hpbGUgKG1hdGNoKSB7XG4gICAgICAgIGNvbGxlY3REYXRlVGltZUZyYWdtZW50KGZyYWdtZW50cywgbWF0Y2gpO1xuICAgICAgICByZW1haW5pbmdUZXh0ID0gcmVtYWluaW5nVGV4dC5zdWJzdHJpbmcobWF0Y2hbMF0ubGVuZ3RoKS50cmltKCk7XG4gICAgICAgIG1hdGNoID0gU0lOR0xFX1RJTUVfVU5JVF9SRUdFWC5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmtleXMoZnJhZ21lbnRzKS5sZW5ndGggPT0gMCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50cztcbn1cbmZ1bmN0aW9uIGNvbGxlY3REYXRlVGltZUZyYWdtZW50KGZyYWdtZW50cywgbWF0Y2gpIHtcbiAgICBpZiAobWF0Y2hbMF0ubWF0Y2goL15bYS16QS1aXSskLykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBudW0gPSBwYXJzZU51bWJlclBhdHRlcm4obWF0Y2hbMV0pO1xuICAgIGNvbnN0IHVuaXQgPSBUSU1FX1VOSVRfRElDVElPTkFSWVttYXRjaFsyXS50b0xvd2VyQ2FzZSgpXTtcbiAgICBmcmFnbWVudHNbdW5pdF0gPSBudW07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb25zdGFudHMuanMubWFwIiwiZXhwb3J0IGNsYXNzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm5IYXNDaGFuZ2UoY29udGV4dCwgY3VycmVudElubmVyUGF0dGVybikge1xuICAgICAgICByZXR1cm4gdGhpcy5pbm5lclBhdHRlcm4oY29udGV4dCkgIT09IGN1cnJlbnRJbm5lclBhdHRlcm47XG4gICAgfVxuICAgIHBhdHRlcm5MZWZ0Qm91bmRhcnkoKSB7XG4gICAgICAgIHJldHVybiBgKFxcXFxXfF4pYDtcbiAgICB9XG4gICAgY2FjaGVkSW5uZXJQYXR0ZXJuID0gbnVsbDtcbiAgICBjYWNoZWRQYXR0ZXJuID0gbnVsbDtcbiAgICBwYXR0ZXJuKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVkSW5uZXJQYXR0ZXJuKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuaW5uZXJQYXR0ZXJuSGFzQ2hhbmdlKGNvbnRleHQsIHRoaXMuY2FjaGVkSW5uZXJQYXR0ZXJuKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFBhdHRlcm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jYWNoZWRJbm5lclBhdHRlcm4gPSB0aGlzLmlubmVyUGF0dGVybihjb250ZXh0KTtcbiAgICAgICAgdGhpcy5jYWNoZWRQYXR0ZXJuID0gbmV3IFJlZ0V4cChgJHt0aGlzLnBhdHRlcm5MZWZ0Qm91bmRhcnkoKX0ke3RoaXMuY2FjaGVkSW5uZXJQYXR0ZXJuLnNvdXJjZX1gLCB0aGlzLmNhY2hlZElubmVyUGF0dGVybi5mbGFncyk7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFBhdHRlcm47XG4gICAgfVxuICAgIGV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgaGVhZGVyID0gbWF0Y2hbMV0gPz8gXCJcIjtcbiAgICAgICAgbWF0Y2guaW5kZXggPSBtYXRjaC5pbmRleCArIGhlYWRlci5sZW5ndGg7XG4gICAgICAgIG1hdGNoWzBdID0gbWF0Y2hbMF0uc3Vic3RyaW5nKGhlYWRlci5sZW5ndGgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMjsgaSA8IG1hdGNoLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBtYXRjaFtpIC0gMV0gPSBtYXRjaFtpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5pbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qcy5tYXAiLCJpbXBvcnQgeyBUSU1FX1VOSVRTX1BBVFRFUk4sIHBhcnNlRHVyYXRpb24sIFRJTUVfVU5JVFNfTk9fQUJCUl9QQVRURVJOIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgUGFyc2luZ0NvbXBvbmVudHMgfSBmcm9tIFwiLi4vLi4vLi4vcmVzdWx0cy5qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBQQVRURVJOX1dJVEhfT1BUSU9OQUxfUFJFRklYID0gbmV3IFJlZ0V4cChgKD86KD86d2l0aGlufGlufGZvcilcXFxccyopP2AgK1xuICAgIGAoPzooPzphYm91dHxhcm91bmR8cm91Z2hseXxhcHByb3hpbWF0ZWx5fGp1c3QpXFxcXHMqKD86flxcXFxzKik/KT8oJHtUSU1FX1VOSVRTX1BBVFRFUk59KSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgUEFUVEVSTl9XSVRIX1BSRUZJWCA9IG5ldyBSZWdFeHAoYCg/OndpdGhpbnxpbnxmb3IpXFxcXHMqYCArXG4gICAgYCg/Oig/OmFib3V0fGFyb3VuZHxyb3VnaGx5fGFwcHJveGltYXRlbHl8anVzdClcXFxccyooPzp+XFxcXHMqKT8pPygke1RJTUVfVU5JVFNfUEFUVEVSTn0pKD89XFxcXFd8JClgLCBcImlcIik7XG5jb25zdCBQQVRURVJOX1dJVEhfUFJFRklYX1NUUklDVCA9IG5ldyBSZWdFeHAoYCg/OndpdGhpbnxpbnxmb3IpXFxcXHMqYCArXG4gICAgYCg/Oig/OmFib3V0fGFyb3VuZHxyb3VnaGx5fGFwcHJveGltYXRlbHl8anVzdClcXFxccyooPzp+XFxcXHMqKT8pPygke1RJTUVfVU5JVFNfTk9fQUJCUl9QQVRURVJOfSkoPz1cXFxcV3wkKWAsIFwiaVwiKTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZVVuaXRXaXRoaW5Gb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgc3RyaWN0TW9kZTtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLnN0cmljdE1vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiBQQVRURVJOX1dJVEhfUFJFRklYX1NUUklDVDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGV4dC5vcHRpb24uZm9yd2FyZERhdGUgPyBQQVRURVJOX1dJVEhfT1BUSU9OQUxfUFJFRklYIDogUEFUVEVSTl9XSVRIX1BSRUZJWDtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGlmIChtYXRjaFswXS5tYXRjaCgvXmZvclxccyp0aGVcXHMqXFx3Ky8pKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0aW1lVW5pdHMgPSBwYXJzZUR1cmF0aW9uKG1hdGNoWzFdKTtcbiAgICAgICAgaWYgKCF0aW1lVW5pdHMpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHRpbWVVbml0cyk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5UaW1lVW5pdFdpdGhpbkZvcm1hdFBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBmaW5kWWVhckNsb3Nlc3RUb1JlZiB9IGZyb20gXCIuLi8uLi8uLi9jYWxjdWxhdGlvbi95ZWFycy5qc1wiO1xuaW1wb3J0IHsgTU9OVEhfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFlFQVJfUEFUVEVSTiwgcGFyc2VZZWFyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgT1JESU5BTF9OVU1CRVJfUEFUVEVSTiwgcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKGAoPzpvblxcXFxzezAsM30pP2AgK1xuICAgIGAoJHtPUkRJTkFMX05VTUJFUl9QQVRURVJOfSlgICtcbiAgICBgKD86YCArXG4gICAgYFxcXFxzezAsM30oPzp0b3xcXFxcLXxcXFxc4oCTfHVudGlsfHRocm91Z2h8dGlsbCk/XFxcXHN7MCwzfWAgK1xuICAgIGAoJHtPUkRJTkFMX05VTUJFUl9QQVRURVJOfSlgICtcbiAgICBcIik/XCIgK1xuICAgIGAoPzotfC98XFxcXHN7MCwzfSg/Om9mKT9cXFxcc3swLDN9KWAgK1xuICAgIGAoJHttYXRjaEFueVBhdHRlcm4oTU9OVEhfRElDVElPTkFSWSl9KWAgK1xuICAgIFwiKD86XCIgK1xuICAgIGAoPzotfC98LD9cXFxcc3swLDN9KWAgK1xuICAgIGAoJHtZRUFSX1BBVFRFUk59KD8hXFxcXHcpKWAgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBEQVRFX0dST1VQID0gMTtcbmNvbnN0IERBVEVfVE9fR1JPVVAgPSAyO1xuY29uc3QgTU9OVEhfTkFNRV9HUk9VUCA9IDM7XG5jb25zdCBZRUFSX0dST1VQID0gNDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTW9udGhOYW1lTGl0dGxlRW5kaWFuUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgY29uc3QgbW9udGggPSBNT05USF9ESUNUSU9OQVJZW21hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCldO1xuICAgICAgICBjb25zdCBkYXkgPSBwYXJzZU9yZGluYWxOdW1iZXJQYXR0ZXJuKG1hdGNoW0RBVEVfR1JPVVBdKTtcbiAgICAgICAgaWYgKGRheSA+IDMxKSB7XG4gICAgICAgICAgICBtYXRjaC5pbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbREFURV9HUk9VUF0ubGVuZ3RoO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIG1vbnRoKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXkpO1xuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXJOdW1iZXIgPSBwYXJzZVllYXIobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgeWVhck51bWJlcik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB5ZWFyID0gZmluZFllYXJDbG9zZXN0VG9SZWYoY29udGV4dC5yZWZEYXRlLCBkYXksIG1vbnRoKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgeWVhcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW0RBVEVfVE9fR1JPVVBdKSB7XG4gICAgICAgICAgICBjb25zdCBlbmREYXRlID0gcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybihtYXRjaFtEQVRFX1RPX0dST1VQXSk7XG4gICAgICAgICAgICByZXN1bHQuZW5kID0gcmVzdWx0LnN0YXJ0LmNsb25lKCk7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImRheVwiLCBlbmREYXRlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOTW9udGhOYW1lTGl0dGxlRW5kaWFuUGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IGZpbmRZZWFyQ2xvc2VzdFRvUmVmIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5pbXBvcnQgeyBNT05USF9ESUNUSU9OQVJZIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgT1JESU5BTF9OVU1CRVJfUEFUVEVSTiwgcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFlFQVJfUEFUVEVSTiwgcGFyc2VZZWFyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgbWF0Y2hBbnlQYXR0ZXJuIH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3BhdHRlcm4uanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCgke21hdGNoQW55UGF0dGVybihNT05USF9ESUNUSU9OQVJZKX0pYCArXG4gICAgXCIoPzotfC98XFxcXHMqLD9cXFxccyopXCIgK1xuICAgIGAoJHtPUkRJTkFMX05VTUJFUl9QQVRURVJOfSkoPyFcXFxccyooPzphbXxwbSkpXFxcXHMqYCArXG4gICAgXCIoPzpcIiArXG4gICAgXCIoPzp0b3xcXFxcLSlcXFxccypcIiArXG4gICAgYCgke09SRElOQUxfTlVNQkVSX1BBVFRFUk59KVxcXFxzKmAgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPzpcIiArXG4gICAgYCg/Oi18L3xcXFxccyosXFxcXHMqfFxcXFxzKylgICtcbiAgICBgKCR7WUVBUl9QQVRURVJOfSlgICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD89XFxcXFd8JCkoPyFcXFxcOlxcXFxkKVwiLCBcImlcIik7XG5jb25zdCBNT05USF9OQU1FX0dST1VQID0gMTtcbmNvbnN0IERBVEVfR1JPVVAgPSAyO1xuY29uc3QgREFURV9UT19HUk9VUCA9IDM7XG5jb25zdCBZRUFSX0dST1VQID0gNDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIHNob3VsZFNraXBZZWFyTGlrZURhdGU7XG4gICAgY29uc3RydWN0b3Ioc2hvdWxkU2tpcFllYXJMaWtlRGF0ZSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnNob3VsZFNraXBZZWFyTGlrZURhdGUgPSBzaG91bGRTa2lwWWVhckxpa2VEYXRlO1xuICAgIH1cbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgbW9udGggPSBNT05USF9ESUNUSU9OQVJZW21hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCldO1xuICAgICAgICBjb25zdCBkYXkgPSBwYXJzZU9yZGluYWxOdW1iZXJQYXR0ZXJuKG1hdGNoW0RBVEVfR1JPVVBdKTtcbiAgICAgICAgaWYgKGRheSA+IDMxKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zaG91bGRTa2lwWWVhckxpa2VEYXRlKSB7XG4gICAgICAgICAgICBpZiAoIW1hdGNoW0RBVEVfVE9fR1JPVVBdICYmICFtYXRjaFtZRUFSX0dST1VQXSAmJiBtYXRjaFtEQVRFX0dST1VQXS5tYXRjaCgvXjJbMC01XSQvKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0XG4gICAgICAgICAgICAuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoe1xuICAgICAgICAgICAgZGF5OiBkYXksXG4gICAgICAgICAgICBtb250aDogbW9udGgsXG4gICAgICAgIH0pXG4gICAgICAgICAgICAuYWRkVGFnKFwicGFyc2VyL0VOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyXCIpO1xuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZVllYXIobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IGZpbmRZZWFyQ2xvc2VzdFRvUmVmKGNvbnRleHQucmVmRGF0ZSwgZGF5LCBtb250aCk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1hdGNoW0RBVEVfVE9fR1JPVVBdKSB7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50cztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlbmREYXRlID0gcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybihtYXRjaFtEQVRFX1RPX0dST1VQXSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChtYXRjaC5pbmRleCwgbWF0Y2hbMF0pO1xuICAgICAgICByZXN1bHQuc3RhcnQgPSBjb21wb25lbnRzO1xuICAgICAgICByZXN1bHQuZW5kID0gY29tcG9uZW50cy5jbG9uZSgpO1xuICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImRheVwiLCBlbmREYXRlKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBGVUxMX01PTlRIX05BTUVfRElDVElPTkFSWSwgTU9OVEhfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IGZpbmRZZWFyQ2xvc2VzdFRvUmVmIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5pbXBvcnQgeyBtYXRjaEFueVBhdHRlcm4gfSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvcGF0dGVybi5qc1wiO1xuaW1wb3J0IHsgWUVBUl9QQVRURVJOLCBwYXJzZVllYXIgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKGAoKD86aW4pXFxcXHMqKT9gICtcbiAgICBgKCR7bWF0Y2hBbnlQYXR0ZXJuKE1PTlRIX0RJQ1RJT05BUlkpfSlgICtcbiAgICBgXFxcXHMqYCArXG4gICAgYCg/OmAgK1xuICAgIGAoPzosfC18b2YpP1xcXFxzKigke1lFQVJfUEFUVEVSTn0pP2AgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPz1bXlxcXFxzXFxcXHddfFxcXFxzK1teMC05XXxcXFxccyskfCQpXCIsIFwiaVwiKTtcbmNvbnN0IFBSRUZJWF9HUk9VUCA9IDE7XG5jb25zdCBNT05USF9OQU1FX0dST1VQID0gMjtcbmNvbnN0IFlFQVJfR1JPVVAgPSAzO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5Nb250aE5hbWVQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IG1vbnRoTmFtZSA9IG1hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChtYXRjaFswXS5sZW5ndGggPD0gMyAmJiAhRlVMTF9NT05USF9OQU1FX0RJQ1RJT05BUllbbW9udGhOYW1lXSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4ICsgKG1hdGNoW1BSRUZJWF9HUk9VUF0gfHwgXCJcIikubGVuZ3RoLCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCAxKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFkZFRhZyhcInBhcnNlci9FTk1vbnRoTmFtZVBhcnNlclwiKTtcbiAgICAgICAgY29uc3QgbW9udGggPSBNT05USF9ESUNUSU9OQVJZW21vbnRoTmFtZV07XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBtb250aCk7XG4gICAgICAgIGlmIChtYXRjaFtZRUFSX0dST1VQXSkge1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IHBhcnNlWWVhcihtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBmaW5kWWVhckNsb3Nlc3RUb1JlZihjb250ZXh0LnJlZkRhdGUsIDEsIG1vbnRoKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgeWVhcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1vbnRoTmFtZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBNT05USF9ESUNUSU9OQVJZIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgbWF0Y2hBbnlQYXR0ZXJuIH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3BhdHRlcm4uanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYChbMC05XXs0fSlbLVxcXFwuXFxcXC9cXFxcc11gICtcbiAgICBgKD86KCR7bWF0Y2hBbnlQYXR0ZXJuKE1PTlRIX0RJQ1RJT05BUlkpfSl8KFswLTldezEsMn0pKVstXFxcXC5cXFxcL1xcXFxzXWAgK1xuICAgIGAoWzAtOV17MSwyfSlgICtcbiAgICBcIig/PVxcXFxXfCQpXCIsIFwiaVwiKTtcbmNvbnN0IFlFQVJfTlVNQkVSX0dST1VQID0gMTtcbmNvbnN0IE1PTlRIX05BTUVfR1JPVVAgPSAyO1xuY29uc3QgTU9OVEhfTlVNQkVSX0dST1VQID0gMztcbmNvbnN0IERBVEVfTlVNQkVSX0dST1VQID0gNDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOWWVhck1vbnRoRGF5UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIHN0cmljdE1vbnRoRGF0ZU9yZGVyO1xuICAgIGNvbnN0cnVjdG9yKHN0cmljdE1vbnRoRGF0ZU9yZGVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9udGhEYXRlT3JkZXIgPSBzdHJpY3RNb250aERhdGVPcmRlcjtcbiAgICB9XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZUludChtYXRjaFtZRUFSX05VTUJFUl9HUk9VUF0pO1xuICAgICAgICBsZXQgZGF5ID0gcGFyc2VJbnQobWF0Y2hbREFURV9OVU1CRVJfR1JPVVBdKTtcbiAgICAgICAgbGV0IG1vbnRoID0gbWF0Y2hbTU9OVEhfTlVNQkVSX0dST1VQXVxuICAgICAgICAgICAgPyBwYXJzZUludChtYXRjaFtNT05USF9OVU1CRVJfR1JPVVBdKVxuICAgICAgICAgICAgOiBNT05USF9ESUNUSU9OQVJZW21hdGNoW01PTlRIX05BTUVfR1JPVVBdLnRvTG93ZXJDYXNlKCldO1xuICAgICAgICBpZiAobW9udGggPCAxIHx8IG1vbnRoID4gMTIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0cmljdE1vbnRoRGF0ZU9yZGVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF5ID49IDEgJiYgZGF5IDw9IDEyKSB7XG4gICAgICAgICAgICAgICAgW21vbnRoLCBkYXldID0gW2RheSwgbW9udGhdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkYXkgPCAxIHx8IGRheSA+IDMxKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZGF5OiBkYXksXG4gICAgICAgICAgICBtb250aDogbW9udGgsXG4gICAgICAgICAgICB5ZWFyOiB5ZWFyLFxuICAgICAgICB9O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOWWVhck1vbnRoRGF5UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoWzAtOV18MFsxLTldfDFbMDEyXSkvKFswLTldezR9KVwiICsgXCJcIiwgXCJpXCIpO1xuY29uc3QgTU9OVEhfR1JPVVAgPSAxO1xuY29uc3QgWUVBUl9HUk9VUCA9IDI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlNsYXNoTW9udGhGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZUludChtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gcGFyc2VJbnQobWF0Y2hbTU9OVEhfR1JPVVBdKTtcbiAgICAgICAgcmV0dXJuIGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoKS5pbXBseShcImRheVwiLCAxKS5hc3NpZ24oXCJtb250aFwiLCBtb250aCkuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTlNsYXNoTW9udGhGb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgTWVyaWRpZW0gfSBmcm9tIFwiLi4vLi4vdHlwZXMuanNcIjtcbmZ1bmN0aW9uIHByaW1hcnlUaW1lUGF0dGVybihsZWZ0Qm91bmRhcnksIHByaW1hcnlQcmVmaXgsIHByaW1hcnlTdWZmaXgsIGZsYWdzKSB7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoYCR7bGVmdEJvdW5kYXJ5fWAgK1xuICAgICAgICBgJHtwcmltYXJ5UHJlZml4fWAgK1xuICAgICAgICBgKFxcXFxkezEsNH0pYCArXG4gICAgICAgIGAoPzpgICtcbiAgICAgICAgYCg/OlxcXFwufDp877yaKWAgK1xuICAgICAgICBgKFxcXFxkezEsMn0pYCArXG4gICAgICAgIGAoPzpgICtcbiAgICAgICAgYCg/Ojp877yaKWAgK1xuICAgICAgICBgKFxcXFxkezJ9KWAgK1xuICAgICAgICBgKD86XFxcXC4oXFxcXGR7MSw2fSkpP2AgK1xuICAgICAgICBgKT9gICtcbiAgICAgICAgYCk/YCArXG4gICAgICAgIGAoPzpcXFxccyooYVxcXFwubVxcXFwufHBcXFxcLm1cXFxcLnxhbT98cG0/KSk/YCArXG4gICAgICAgIGAke3ByaW1hcnlTdWZmaXh9YCwgZmxhZ3MpO1xufVxuZnVuY3Rpb24gZm9sbG93aW5nVGltZVBhdHRlbihmb2xsb3dpbmdQaGFzZSwgZm9sbG93aW5nU3VmZml4KSB7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoYF4oJHtmb2xsb3dpbmdQaGFzZX0pYCArXG4gICAgICAgIGAoXFxcXGR7MSw0fSlgICtcbiAgICAgICAgYCg/OmAgK1xuICAgICAgICBgKD86XFxcXC58XFxcXDp8XFxcXO+8milgICtcbiAgICAgICAgYChcXFxcZHsxLDJ9KWAgK1xuICAgICAgICBgKD86YCArXG4gICAgICAgIGAoPzpcXFxcLnxcXFxcOnxcXFxc77yaKWAgK1xuICAgICAgICBgKFxcXFxkezEsMn0pKD86XFxcXC4oXFxcXGR7MSw2fSkpP2AgK1xuICAgICAgICBgKT9gICtcbiAgICAgICAgYCk/YCArXG4gICAgICAgIGAoPzpcXFxccyooYVxcXFwubVxcXFwufHBcXFxcLm1cXFxcLnxhbT98cG0/KSk/YCArXG4gICAgICAgIGAke2ZvbGxvd2luZ1N1ZmZpeH1gLCBcImlcIik7XG59XG5jb25zdCBIT1VSX0dST1VQID0gMjtcbmNvbnN0IE1JTlVURV9HUk9VUCA9IDM7XG5jb25zdCBTRUNPTkRfR1JPVVAgPSA0O1xuY29uc3QgTUlMTElfU0VDT05EX0dST1VQID0gNTtcbmNvbnN0IEFNX1BNX0hPVVJfR1JPVVAgPSA2O1xuZXhwb3J0IGNsYXNzIEFic3RyYWN0VGltZUV4cHJlc3Npb25QYXJzZXIge1xuICAgIHN0cmljdE1vZGU7XG4gICAgY29uc3RydWN0b3Ioc3RyaWN0TW9kZSA9IGZhbHNlKSB7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIHBhdHRlcm5GbGFncygpIHtcbiAgICAgICAgcmV0dXJuIFwiaVwiO1xuICAgIH1cbiAgICBwcmltYXJ5UGF0dGVybkxlZnRCb3VuZGFyeSgpIHtcbiAgICAgICAgcmV0dXJuIGAoXnxcXFxcc3xUfFxcXFxiKWA7XG4gICAgfVxuICAgIHByaW1hcnlTdWZmaXgoKSB7XG4gICAgICAgIHJldHVybiBgKD8hLykoPz1cXFxcV3wkKWA7XG4gICAgfVxuICAgIGZvbGxvd2luZ1N1ZmZpeCgpIHtcbiAgICAgICAgcmV0dXJuIGAoPyEvKSg/PVxcXFxXfCQpYDtcbiAgICB9XG4gICAgcGF0dGVybihjb250ZXh0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldFByaW1hcnlUaW1lUGF0dGVyblRocm91Z2hDYWNoZSgpO1xuICAgIH1cbiAgICBleHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHN0YXJ0Q29tcG9uZW50cyA9IHRoaXMuZXh0cmFjdFByaW1hcnlUaW1lQ29tcG9uZW50cyhjb250ZXh0LCBtYXRjaCk7XG4gICAgICAgIGlmICghc3RhcnRDb21wb25lbnRzKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2hbMF0ubWF0Y2goL15cXGR7NH0vKSkge1xuICAgICAgICAgICAgICAgIG1hdGNoLmluZGV4ICs9IDQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtYXRjaC5pbmRleCArPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBpbmRleCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbMV0ubGVuZ3RoO1xuICAgICAgICBjb25zdCB0ZXh0ID0gbWF0Y2hbMF0uc3Vic3RyaW5nKG1hdGNoWzFdLmxlbmd0aCk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChpbmRleCwgdGV4dCwgc3RhcnRDb21wb25lbnRzKTtcbiAgICAgICAgbWF0Y2guaW5kZXggKz0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICBjb25zdCByZW1haW5pbmdUZXh0ID0gY29udGV4dC50ZXh0LnN1YnN0cmluZyhtYXRjaC5pbmRleCk7XG4gICAgICAgIGNvbnN0IGZvbGxvd2luZ1BhdHRlcm4gPSB0aGlzLmdldEZvbGxvd2luZ1RpbWVQYXR0ZXJuVGhyb3VnaENhY2hlKCk7XG4gICAgICAgIGNvbnN0IGZvbGxvd2luZ01hdGNoID0gZm9sbG93aW5nUGF0dGVybi5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgICAgICBpZiAodGV4dC5tYXRjaCgvXlxcZHszLDR9LykgJiYgZm9sbG93aW5nTWF0Y2gpIHtcbiAgICAgICAgICAgIGlmIChmb2xsb3dpbmdNYXRjaFswXS5tYXRjaCgvXlxccyooWystXSlcXHMqXFxkezIsNH0kLykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb2xsb3dpbmdNYXRjaFswXS5tYXRjaCgvXlxccyooWystXSlcXHMqXFxkezJ9XFxXXFxkezJ9LykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWZvbGxvd2luZ01hdGNoIHx8XG4gICAgICAgICAgICBmb2xsb3dpbmdNYXRjaFswXS5tYXRjaCgvXlxccyooWystXSlcXHMqXFxkezMsNH0kLykpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNoZWNrQW5kUmV0dXJuV2l0aG91dEZvbGxvd2luZ1BhdHRlcm4ocmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuZW5kID0gdGhpcy5leHRyYWN0Rm9sbG93aW5nVGltZUNvbXBvbmVudHMoY29udGV4dCwgZm9sbG93aW5nTWF0Y2gsIHJlc3VsdCk7XG4gICAgICAgIGlmIChyZXN1bHQuZW5kKSB7XG4gICAgICAgICAgICByZXN1bHQudGV4dCArPSBmb2xsb3dpbmdNYXRjaFswXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5jaGVja0FuZFJldHVybldpdGhGb2xsb3dpbmdQYXR0ZXJuKHJlc3VsdCk7XG4gICAgfVxuICAgIGV4dHJhY3RQcmltYXJ5VGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gsIHN0cmljdCA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKCk7XG4gICAgICAgIGxldCBtaW51dGUgPSAwO1xuICAgICAgICBsZXQgbWVyaWRpZW0gPSBudWxsO1xuICAgICAgICBsZXQgaG91ciA9IHBhcnNlSW50KG1hdGNoW0hPVVJfR1JPVVBdKTtcbiAgICAgICAgaWYgKGhvdXIgPiAxMDApIHtcbiAgICAgICAgICAgIGlmIChtYXRjaFtIT1VSX0dST1VQXS5sZW5ndGggPT0gNCAmJiBtYXRjaFtNSU5VVEVfR1JPVVBdID09IG51bGwgJiYgIW1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zdHJpY3RNb2RlIHx8IG1hdGNoW01JTlVURV9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWludXRlID0gaG91ciAlIDEwMDtcbiAgICAgICAgICAgIGhvdXIgPSBNYXRoLmZsb29yKGhvdXIgLyAxMDApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID4gMjQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdLmxlbmd0aCA9PSAxICYmICFtYXRjaFtBTV9QTV9IT1VSX0dST1VQXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWludXRlID0gcGFyc2VJbnQobWF0Y2hbTUlOVVRFX0dST1VQXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1pbnV0ZSA+PSA2MCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhvdXIgPiAxMikge1xuICAgICAgICAgICAgbWVyaWRpZW0gPSBNZXJpZGllbS5QTTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbQU1fUE1fSE9VUl9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGhvdXIgPiAxMilcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGFtcG0gPSBtYXRjaFtBTV9QTV9IT1VSX0dST1VQXVswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJhXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IE1lcmlkaWVtLkFNO1xuICAgICAgICAgICAgICAgIGlmIChob3VyID09IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhbXBtID09IFwicFwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSBNZXJpZGllbS5QTTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMikge1xuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImhvdXJcIiwgaG91cik7XG4gICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWludXRlXCIsIG1pbnV0ZSk7XG4gICAgICAgIGlmIChtZXJpZGllbSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtZXJpZGllbVwiLCBtZXJpZGllbSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoaG91ciA8IDEyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW01JTExJX1NFQ09ORF9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3QgbWlsbGlzZWNvbmQgPSBwYXJzZUludChtYXRjaFtNSUxMSV9TRUNPTkRfR1JPVVBdLnN1YnN0cmluZygwLCAzKSk7XG4gICAgICAgICAgICBpZiAobWlsbGlzZWNvbmQgPj0gMTAwMClcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWlsbGlzZWNvbmRcIiwgbWlsbGlzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtTRUNPTkRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlY29uZCA9IHBhcnNlSW50KG1hdGNoW1NFQ09ORF9HUk9VUF0pO1xuICAgICAgICAgICAgaWYgKHNlY29uZCA+PSA2MClcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwic2Vjb25kXCIsIHNlY29uZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgfVxuICAgIGV4dHJhY3RGb2xsb3dpbmdUaW1lQ29tcG9uZW50cyhjb250ZXh0LCBtYXRjaCwgcmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKCk7XG4gICAgICAgIGlmIChtYXRjaFtNSUxMSV9TRUNPTkRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG1pbGxpc2Vjb25kID0gcGFyc2VJbnQobWF0Y2hbTUlMTElfU0VDT05EX0dST1VQXS5zdWJzdHJpbmcoMCwgMykpO1xuICAgICAgICAgICAgaWYgKG1pbGxpc2Vjb25kID49IDEwMDApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1pbGxpc2Vjb25kXCIsIG1pbGxpc2Vjb25kKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbU0VDT05EX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBzZWNvbmQgPSBwYXJzZUludChtYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChzZWNvbmQgPj0gNjApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInNlY29uZFwiLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBob3VyID0gcGFyc2VJbnQobWF0Y2hbSE9VUl9HUk9VUF0pO1xuICAgICAgICBsZXQgbWludXRlID0gMDtcbiAgICAgICAgbGV0IG1lcmlkaWVtID0gLTE7XG4gICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIG1pbnV0ZSA9IHBhcnNlSW50KG1hdGNoW01JTlVURV9HUk9VUF0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGhvdXIgPiAxMDApIHtcbiAgICAgICAgICAgIG1pbnV0ZSA9IGhvdXIgJSAxMDA7XG4gICAgICAgICAgICBob3VyID0gTWF0aC5mbG9vcihob3VyIC8gMTAwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWludXRlID49IDYwIHx8IGhvdXIgPiAyNCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhvdXIgPj0gMTIpIHtcbiAgICAgICAgICAgIG1lcmlkaWVtID0gTWVyaWRpZW0uUE07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChob3VyID4gMTIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFtcG0gPSBtYXRjaFtBTV9QTV9IT1VSX0dST1VQXVswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJhXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IE1lcmlkaWVtLkFNO1xuICAgICAgICAgICAgICAgIGlmIChob3VyID09IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbXBvbmVudHMuaXNDZXJ0YWluKFwiZGF5XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGNvbXBvbmVudHMuZ2V0KFwiZGF5XCIpICsgMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYW1wbSA9PSBcInBcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gTWVyaWRpZW0uUE07XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSkge1xuICAgICAgICAgICAgICAgIGlmIChtZXJpZGllbSA9PSBNZXJpZGllbS5BTSkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSA9PSAxMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImhvdXJcIiwgMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5nZXQoXCJob3VyXCIpICE9IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImhvdXJcIiwgaG91cik7XG4gICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWludXRlXCIsIG1pbnV0ZSk7XG4gICAgICAgIGlmIChtZXJpZGllbSA+PSAwKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIG1lcmlkaWVtKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0QXRQTSA9IHJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSAmJiByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSA+IDEyO1xuICAgICAgICAgICAgaWYgKHN0YXJ0QXRQTSkge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSAtIDEyID4gaG91cikge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uQU0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChob3VyIDw9IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiaG91clwiLCBob3VyICsgMTIpO1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChob3VyID4gMTIpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaG91ciA8PSAxMikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbXBvbmVudHMuZGF0ZSgpLmdldFRpbWUoKSA8IHJlc3VsdC5zdGFydC5kYXRlKCkuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGNvbXBvbmVudHMuZ2V0KFwiZGF5XCIpICsgMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgfVxuICAgIGNoZWNrQW5kUmV0dXJuV2l0aG91dEZvbGxvd2luZ1BhdHRlcm4ocmVzdWx0KSB7XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5tYXRjaCgvXlxcZCQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC50ZXh0Lm1hdGNoKC9eXFxkXFxkXFxkKyQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC50ZXh0Lm1hdGNoKC9cXGRbYXBBUF0kLykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVuZGluZ1dpdGhOdW1iZXJzID0gcmVzdWx0LnRleHQubWF0Y2goL1teXFxkOi5dKFxcZFtcXGQuXSspJC8pO1xuICAgICAgICBpZiAoZW5kaW5nV2l0aE51bWJlcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGVuZGluZ051bWJlcnMgPSBlbmRpbmdXaXRoTnVtYmVyc1sxXTtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0cmljdE1vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChlbmRpbmdOdW1iZXJzLmluY2x1ZGVzKFwiLlwiKSAmJiAhZW5kaW5nTnVtYmVycy5tYXRjaCgvXFxkKFxcLlxcZHsyfSkrJC8pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBlbmRpbmdOdW1iZXJWYWwgPSBwYXJzZUludChlbmRpbmdOdW1iZXJzKTtcbiAgICAgICAgICAgIGlmIChlbmRpbmdOdW1iZXJWYWwgPiAyNCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGNoZWNrQW5kUmV0dXJuV2l0aEZvbGxvd2luZ1BhdHRlcm4ocmVzdWx0KSB7XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5tYXRjaCgvXlxcZCstXFxkKyQvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZW5kaW5nV2l0aE51bWJlcnMgPSByZXN1bHQudGV4dC5tYXRjaCgvW15cXGQ6Ll0oXFxkW1xcZC5dKylcXHMqLVxccyooXFxkW1xcZC5dKykkLyk7XG4gICAgICAgIGlmIChlbmRpbmdXaXRoTnVtYmVycykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3RyaWN0TW9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3RhcnRpbmdOdW1iZXJzID0gZW5kaW5nV2l0aE51bWJlcnNbMV07XG4gICAgICAgICAgICBjb25zdCBlbmRpbmdOdW1iZXJzID0gZW5kaW5nV2l0aE51bWJlcnNbMl07XG4gICAgICAgICAgICBpZiAoZW5kaW5nTnVtYmVycy5pbmNsdWRlcyhcIi5cIikgJiYgIWVuZGluZ051bWJlcnMubWF0Y2goL1xcZChcXC5cXGR7Mn0pKyQvKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZW5kaW5nTnVtYmVyVmFsID0gcGFyc2VJbnQoZW5kaW5nTnVtYmVycyk7XG4gICAgICAgICAgICBjb25zdCBzdGFydGluZ051bWJlclZhbCA9IHBhcnNlSW50KHN0YXJ0aW5nTnVtYmVycyk7XG4gICAgICAgICAgICBpZiAoZW5kaW5nTnVtYmVyVmFsID4gMjQgfHwgc3RhcnRpbmdOdW1iZXJWYWwgPiAyNCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIGNhY2hlZFByaW1hcnlQcmVmaXggPSBudWxsO1xuICAgIGNhY2hlZFByaW1hcnlTdWZmaXggPSBudWxsO1xuICAgIGNhY2hlZFByaW1hcnlUaW1lUGF0dGVybiA9IG51bGw7XG4gICAgZ2V0UHJpbWFyeVRpbWVQYXR0ZXJuVGhyb3VnaENhY2hlKCkge1xuICAgICAgICBjb25zdCBwcmltYXJ5UHJlZml4ID0gdGhpcy5wcmltYXJ5UHJlZml4KCk7XG4gICAgICAgIGNvbnN0IHByaW1hcnlTdWZmaXggPSB0aGlzLnByaW1hcnlTdWZmaXgoKTtcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVkUHJpbWFyeVByZWZpeCA9PT0gcHJpbWFyeVByZWZpeCAmJiB0aGlzLmNhY2hlZFByaW1hcnlTdWZmaXggPT09IHByaW1hcnlTdWZmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFByaW1hcnlUaW1lUGF0dGVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNhY2hlZFByaW1hcnlUaW1lUGF0dGVybiA9IHByaW1hcnlUaW1lUGF0dGVybih0aGlzLnByaW1hcnlQYXR0ZXJuTGVmdEJvdW5kYXJ5KCksIHByaW1hcnlQcmVmaXgsIHByaW1hcnlTdWZmaXgsIHRoaXMucGF0dGVybkZsYWdzKCkpO1xuICAgICAgICB0aGlzLmNhY2hlZFByaW1hcnlQcmVmaXggPSBwcmltYXJ5UHJlZml4O1xuICAgICAgICB0aGlzLmNhY2hlZFByaW1hcnlTdWZmaXggPSBwcmltYXJ5U3VmZml4O1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZWRQcmltYXJ5VGltZVBhdHRlcm47XG4gICAgfVxuICAgIGNhY2hlZEZvbGxvd2luZ1BoYXNlID0gbnVsbDtcbiAgICBjYWNoZWRGb2xsb3dpbmdTdWZmaXggPSBudWxsO1xuICAgIGNhY2hlZEZvbGxvd2luZ1RpbWVQYXR0ZW4gPSBudWxsO1xuICAgIGdldEZvbGxvd2luZ1RpbWVQYXR0ZXJuVGhyb3VnaENhY2hlKCkge1xuICAgICAgICBjb25zdCBmb2xsb3dpbmdQaGFzZSA9IHRoaXMuZm9sbG93aW5nUGhhc2UoKTtcbiAgICAgICAgY29uc3QgZm9sbG93aW5nU3VmZml4ID0gdGhpcy5mb2xsb3dpbmdTdWZmaXgoKTtcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVkRm9sbG93aW5nUGhhc2UgPT09IGZvbGxvd2luZ1BoYXNlICYmIHRoaXMuY2FjaGVkRm9sbG93aW5nU3VmZml4ID09PSBmb2xsb3dpbmdTdWZmaXgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlZEZvbGxvd2luZ1RpbWVQYXR0ZW47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jYWNoZWRGb2xsb3dpbmdUaW1lUGF0dGVuID0gZm9sbG93aW5nVGltZVBhdHRlbihmb2xsb3dpbmdQaGFzZSwgZm9sbG93aW5nU3VmZml4KTtcbiAgICAgICAgdGhpcy5jYWNoZWRGb2xsb3dpbmdQaGFzZSA9IGZvbGxvd2luZ1BoYXNlO1xuICAgICAgICB0aGlzLmNhY2hlZEZvbGxvd2luZ1N1ZmZpeCA9IGZvbGxvd2luZ1N1ZmZpeDtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FjaGVkRm9sbG93aW5nVGltZVBhdHRlbjtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1BYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IE1lcmlkaWVtIH0gZnJvbSBcIi4uLy4uLy4uL3R5cGVzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0VGltZUV4cHJlc3Npb25QYXJzZXIuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZUV4cHJlc3Npb25QYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyIHtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKHN0cmljdE1vZGUpO1xuICAgIH1cbiAgICBmb2xsb3dpbmdQaGFzZSgpIHtcbiAgICAgICAgcmV0dXJuIFwiXFxcXHMqKD86XFxcXC18XFxcXOKAk3xcXFxcfnxcXFxc44CcfHRvfHVudGlsfHRocm91Z2h8dGlsbHxcXFxcPylcXFxccypcIjtcbiAgICB9XG4gICAgcHJpbWFyeVByZWZpeCgpIHtcbiAgICAgICAgcmV0dXJuIFwiKD86KD86YXR8ZnJvbSlcXFxccyopPz9cIjtcbiAgICB9XG4gICAgcHJpbWFyeVN1ZmZpeCgpIHtcbiAgICAgICAgcmV0dXJuIFwiKD86XFxcXHMqKD86b1xcXFxXKmNsb2NrfGF0XFxcXHMqbmlnaHR8aW5cXFxccyp0aGVcXFxccyooPzptb3JuaW5nfGFmdGVybm9vbikpKT8oPyEvKSg/PVxcXFxXfCQpXCI7XG4gICAgfVxuICAgIGV4dHJhY3RQcmltYXJ5VGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IHN1cGVyLmV4dHJhY3RQcmltYXJ5VGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gpO1xuICAgICAgICBpZiAoIWNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnRzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFswXS5lbmRzV2l0aChcIm5pZ2h0XCIpKSB7XG4gICAgICAgICAgICBjb25zdCBob3VyID0gY29tcG9uZW50cy5nZXQoXCJob3VyXCIpO1xuICAgICAgICAgICAgaWYgKGhvdXIgPj0gNiAmJiBob3VyIDwgMTIpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImhvdXJcIiwgY29tcG9uZW50cy5nZXQoXCJob3VyXCIpICsgMTIpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaG91ciA8IDYpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbMF0uZW5kc1dpdGgoXCJhZnRlcm5vb25cIikpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgICAgICAgICAgY29uc3QgaG91ciA9IGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKTtcbiAgICAgICAgICAgIGlmIChob3VyID49IDAgJiYgaG91ciA8PSA2KSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbMF0uZW5kc1dpdGgoXCJtb3JuaW5nXCIpKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICAgICAgICAgIGNvbnN0IGhvdXIgPSBjb21wb25lbnRzLmdldChcImhvdXJcIik7XG4gICAgICAgICAgICBpZiAoaG91ciA8IDEyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHMuYWRkVGFnKFwicGFyc2VyL0VOVGltZUV4cHJlc3Npb25QYXJzZXJcIik7XG4gICAgfVxuICAgIGV4dHJhY3RGb2xsb3dpbmdUaW1lQ29tcG9uZW50cyhjb250ZXh0LCBtYXRjaCwgcmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IGZvbGxvd2luZ0NvbXBvbmVudHMgPSBzdXBlci5leHRyYWN0Rm9sbG93aW5nVGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gsIHJlc3VsdCk7XG4gICAgICAgIGlmIChmb2xsb3dpbmdDb21wb25lbnRzKSB7XG4gICAgICAgICAgICBmb2xsb3dpbmdDb21wb25lbnRzLmFkZFRhZyhcInBhcnNlci9FTlRpbWVFeHByZXNzaW9uUGFyc2VyXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmb2xsb3dpbmdDb21wb25lbnRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZUV4cHJlc3Npb25QYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgcGFyc2VEdXJhdGlvbiwgVElNRV9VTklUU19OT19BQkJSX1BBVFRFUk4sIFRJTUVfVU5JVFNfUEFUVEVSTiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuaW1wb3J0IHsgcmV2ZXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKCR7VElNRV9VTklUU19QQVRURVJOfSlcXFxcc3swLDV9KD86YWdvfGJlZm9yZXxlYXJsaWVyKSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgU1RSSUNUX1BBVFRFUk4gPSBuZXcgUmVnRXhwKGAoJHtUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTn0pXFxcXHN7MCw1fSg/OmFnb3xiZWZvcmV8ZWFybGllcikoPz1cXFxcV3wkKWAsIFwiaVwiKTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgc3RyaWN0TW9kZTtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaWN0TW9kZSA/IFNUUklDVF9QQVRURVJOIDogUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0gcGFyc2VEdXJhdGlvbihtYXRjaFsxXSk7XG4gICAgICAgIGlmICghZHVyYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHJldmVyc2VEdXJhdGlvbihkdXJhdGlvbikpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgcGFyc2VEdXJhdGlvbiwgVElNRV9VTklUU19OT19BQkJSX1BBVFRFUk4sIFRJTUVfVU5JVFNfUEFUVEVSTiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCgke1RJTUVfVU5JVFNfUEFUVEVSTn0pXFxcXHN7MCw1fSg/OmxhdGVyfGFmdGVyfGZyb20gbm93fGhlbmNlZm9ydGh8Zm9yd2FyZHxvdXQpYCArIFwiKD89KD86XFxcXFd8JCkpXCIsIFwiaVwiKTtcbmNvbnN0IFNUUklDVF9QQVRURVJOID0gbmV3IFJlZ0V4cChgKCR7VElNRV9VTklUU19OT19BQkJSX1BBVFRFUk59KVxcXFxzezAsNX0obGF0ZXJ8YWZ0ZXJ8ZnJvbSBub3cpKD89XFxcXFd8JClgLCBcImlcIik7XG5jb25zdCBHUk9VUF9OVU1fVElNRVVOSVRTID0gMTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVGltZVVuaXRMYXRlckZvcm1hdFBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBzdHJpY3RNb2RlO1xuICAgIGNvbnN0cnVjdG9yKHN0cmljdE1vZGUpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5zdHJpY3RNb2RlID0gc3RyaWN0TW9kZTtcbiAgICB9XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJpY3RNb2RlID8gU1RSSUNUX1BBVFRFUk4gOiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgdGltZVVuaXRzID0gcGFyc2VEdXJhdGlvbihtYXRjaFtHUk9VUF9OVU1fVElNRVVOSVRTXSk7XG4gICAgICAgIGlmICghdGltZVVuaXRzKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCB0aW1lVW5pdHMpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZVVuaXRMYXRlckZvcm1hdFBhcnNlci5qcy5tYXAiLCJleHBvcnQgY2xhc3MgRmlsdGVyIHtcbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICByZXR1cm4gcmVzdWx0cy5maWx0ZXIoKHIpID0+IHRoaXMuaXNWYWxpZChjb250ZXh0LCByKSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICBpZiAocmVzdWx0cy5sZW5ndGggPCAyKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtZXJnZWRSZXN1bHRzID0gW107XG4gICAgICAgIGxldCBjdXJSZXN1bHQgPSByZXN1bHRzWzBdO1xuICAgICAgICBsZXQgbmV4dFJlc3VsdCA9IG51bGw7XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbmV4dFJlc3VsdCA9IHJlc3VsdHNbaV07XG4gICAgICAgICAgICBjb25zdCB0ZXh0QmV0d2VlbiA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcoY3VyUmVzdWx0LmluZGV4ICsgY3VyUmVzdWx0LnRleHQubGVuZ3RoLCBuZXh0UmVzdWx0LmluZGV4KTtcbiAgICAgICAgICAgIGlmICghdGhpcy5zaG91bGRNZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1clJlc3VsdCwgbmV4dFJlc3VsdCwgY29udGV4dCkpIHtcbiAgICAgICAgICAgICAgICBtZXJnZWRSZXN1bHRzLnB1c2goY3VyUmVzdWx0KTtcbiAgICAgICAgICAgICAgICBjdXJSZXN1bHQgPSBuZXh0UmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVmdCA9IGN1clJlc3VsdDtcbiAgICAgICAgICAgICAgICBjb25zdCByaWdodCA9IG5leHRSZXN1bHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVyZ2VkUmVzdWx0ID0gdGhpcy5tZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGxlZnQsIHJpZ2h0LCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBtZXJnZWQgJHtsZWZ0fSBhbmQgJHtyaWdodH0gaW50byAke21lcmdlZFJlc3VsdH1gKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjdXJSZXN1bHQgPSBtZXJnZWRSZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1clJlc3VsdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBtZXJnZWRSZXN1bHRzLnB1c2goY3VyUmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWVyZ2VkUmVzdWx0cztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1hYnN0cmFjdFJlZmluZXJzLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uL2Fic3RyYWN0UmVmaW5lcnMuanNcIjtcbmltcG9ydCB7IGFkZER1cmF0aW9uIH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciBleHRlbmRzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICBzaG91bGRNZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuICFjdXJyZW50UmVzdWx0LmVuZCAmJiAhbmV4dFJlc3VsdC5lbmQgJiYgdGV4dEJldHdlZW4ubWF0Y2godGhpcy5wYXR0ZXJuQmV0d2VlbigpKSAhPSBudWxsO1xuICAgIH1cbiAgICBtZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGZyb21SZXN1bHQsIHRvUmVzdWx0KSB7XG4gICAgICAgIGlmICghZnJvbVJlc3VsdC5zdGFydC5pc09ubHlXZWVrZGF5Q29tcG9uZW50KCkgJiYgIXRvUmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSkge1xuICAgICAgICAgICAgdG9SZXN1bHQuc3RhcnQuZ2V0Q2VydGFpbkNvbXBvbmVudHMoKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWZyb21SZXN1bHQuc3RhcnQuaXNDZXJ0YWluKGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbVJlc3VsdC5zdGFydC5pbXBseShrZXksIHRvUmVzdWx0LnN0YXJ0LmdldChrZXkpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGZyb21SZXN1bHQuc3RhcnQuZ2V0Q2VydGFpbkNvbXBvbmVudHMoKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXRvUmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KGtleSwgZnJvbVJlc3VsdC5zdGFydC5nZXQoa2V5KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZyb21SZXN1bHQuc3RhcnQuZGF0ZSgpID4gdG9SZXN1bHQuc3RhcnQuZGF0ZSgpKSB7XG4gICAgICAgICAgICBsZXQgZnJvbURhdGUgPSBmcm9tUmVzdWx0LnN0YXJ0LmRhdGUoKTtcbiAgICAgICAgICAgIGxldCB0b0RhdGUgPSB0b1Jlc3VsdC5zdGFydC5kYXRlKCk7XG4gICAgICAgICAgICBpZiAodG9SZXN1bHQuc3RhcnQuaXNPbmx5V2Vla2RheUNvbXBvbmVudCgpICYmIGFkZER1cmF0aW9uKHRvRGF0ZSwgeyBkYXk6IDcgfSkgPiBmcm9tRGF0ZSkge1xuICAgICAgICAgICAgICAgIHRvRGF0ZSA9IGFkZER1cmF0aW9uKHRvRGF0ZSwgeyBkYXk6IDcgfSk7XG4gICAgICAgICAgICAgICAgdG9SZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgdG9EYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICAgICAgdG9SZXN1bHQuc3RhcnQuaW1wbHkoXCJtb250aFwiLCB0b0RhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCB0b0RhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChmcm9tUmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSAmJiBhZGREdXJhdGlvbihmcm9tRGF0ZSwgeyBkYXk6IC03IH0pIDwgdG9EYXRlKSB7XG4gICAgICAgICAgICAgICAgZnJvbURhdGUgPSBhZGREdXJhdGlvbihmcm9tRGF0ZSwgeyBkYXk6IC03IH0pO1xuICAgICAgICAgICAgICAgIGZyb21SZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgZnJvbURhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgICAgICBmcm9tUmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgZnJvbURhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgIGZyb21SZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIGZyb21EYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodG9SZXN1bHQuc3RhcnQuaXNEYXRlV2l0aFVua25vd25ZZWFyKCkgJiYgYWRkRHVyYXRpb24odG9EYXRlLCB7IHllYXI6IDEgfSkgPiBmcm9tRGF0ZSkge1xuICAgICAgICAgICAgICAgIHRvRGF0ZSA9IGFkZER1cmF0aW9uKHRvRGF0ZSwgeyB5ZWFyOiAxIH0pO1xuICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCB0b0RhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChmcm9tUmVzdWx0LnN0YXJ0LmlzRGF0ZVdpdGhVbmtub3duWWVhcigpICYmIGFkZER1cmF0aW9uKGZyb21EYXRlLCB7IHllYXI6IC0xIH0pIDwgdG9EYXRlKSB7XG4gICAgICAgICAgICAgICAgZnJvbURhdGUgPSBhZGREdXJhdGlvbihmcm9tRGF0ZSwgeyB5ZWFyOiAtMSB9KTtcbiAgICAgICAgICAgICAgICBmcm9tUmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCBmcm9tRGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIFt0b1Jlc3VsdCwgZnJvbVJlc3VsdF0gPSBbZnJvbVJlc3VsdCwgdG9SZXN1bHRdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGZyb21SZXN1bHQuY2xvbmUoKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0ID0gZnJvbVJlc3VsdC5zdGFydDtcbiAgICAgICAgcmVzdWx0LmVuZCA9IHRvUmVzdWx0LnN0YXJ0O1xuICAgICAgICByZXN1bHQuaW5kZXggPSBNYXRoLm1pbihmcm9tUmVzdWx0LmluZGV4LCB0b1Jlc3VsdC5pbmRleCk7XG4gICAgICAgIGlmIChmcm9tUmVzdWx0LmluZGV4IDwgdG9SZXN1bHQuaW5kZXgpIHtcbiAgICAgICAgICAgIHJlc3VsdC50ZXh0ID0gZnJvbVJlc3VsdC50ZXh0ICsgdGV4dEJldHdlZW4gKyB0b1Jlc3VsdC50ZXh0O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LnRleHQgPSB0b1Jlc3VsdC50ZXh0ICsgdGV4dEJldHdlZW4gKyBmcm9tUmVzdWx0LnRleHQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1BYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgQWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIgZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5NZXJnZURhdGVSYW5nZVJlZmluZXIgZXh0ZW5kcyBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciB7XG4gICAgcGF0dGVybkJldHdlZW4oKSB7XG4gICAgICAgIHJldHVybiAvXlxccyoodG98LXzigJN8dW50aWx8dGhyb3VnaHx0aWxsKVxccyokL2k7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5NZXJnZURhdGVSYW5nZVJlZmluZXIuanMubWFwIiwiaW1wb3J0IHsgTWVyaWRpZW0gfSBmcm9tIFwiLi4vdHlwZXMuanNcIjtcbmltcG9ydCB7IGFzc2lnblNpbWlsYXJEYXRlLCBpbXBseVNpbWlsYXJEYXRlIH0gZnJvbSBcIi4uL3V0aWxzL2RhdGVzLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VEYXRlVGltZVJlc3VsdChkYXRlUmVzdWx0LCB0aW1lUmVzdWx0KSB7XG4gICAgY29uc3QgcmVzdWx0ID0gZGF0ZVJlc3VsdC5jbG9uZSgpO1xuICAgIGNvbnN0IGJlZ2luRGF0ZSA9IGRhdGVSZXN1bHQuc3RhcnQ7XG4gICAgY29uc3QgYmVnaW5UaW1lID0gdGltZVJlc3VsdC5zdGFydDtcbiAgICByZXN1bHQuc3RhcnQgPSBtZXJnZURhdGVUaW1lQ29tcG9uZW50KGJlZ2luRGF0ZSwgYmVnaW5UaW1lKTtcbiAgICBpZiAoZGF0ZVJlc3VsdC5lbmQgIT0gbnVsbCB8fCB0aW1lUmVzdWx0LmVuZCAhPSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGVuZERhdGUgPSBkYXRlUmVzdWx0LmVuZCA9PSBudWxsID8gZGF0ZVJlc3VsdC5zdGFydCA6IGRhdGVSZXN1bHQuZW5kO1xuICAgICAgICBjb25zdCBlbmRUaW1lID0gdGltZVJlc3VsdC5lbmQgPT0gbnVsbCA/IHRpbWVSZXN1bHQuc3RhcnQgOiB0aW1lUmVzdWx0LmVuZDtcbiAgICAgICAgY29uc3QgZW5kRGF0ZVRpbWUgPSBtZXJnZURhdGVUaW1lQ29tcG9uZW50KGVuZERhdGUsIGVuZFRpbWUpO1xuICAgICAgICBpZiAoZGF0ZVJlc3VsdC5lbmQgPT0gbnVsbCAmJiBlbmREYXRlVGltZS5kYXRlKCkuZ2V0VGltZSgpIDwgcmVzdWx0LnN0YXJ0LmRhdGUoKS5nZXRUaW1lKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5leHREYXkgPSBuZXcgRGF0ZShlbmREYXRlVGltZS5kYXRlKCkuZ2V0VGltZSgpKTtcbiAgICAgICAgICAgIG5leHREYXkuc2V0RGF0ZShuZXh0RGF5LmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgaWYgKGVuZERhdGVUaW1lLmlzQ2VydGFpbihcImRheVwiKSkge1xuICAgICAgICAgICAgICAgIGFzc2lnblNpbWlsYXJEYXRlKGVuZERhdGVUaW1lLCBuZXh0RGF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGltcGx5U2ltaWxhckRhdGUoZW5kRGF0ZVRpbWUsIG5leHREYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5lbmQgPSBlbmREYXRlVGltZTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtZXJnZURhdGVUaW1lQ29tcG9uZW50KGRhdGVDb21wb25lbnQsIHRpbWVDb21wb25lbnQpIHtcbiAgICBjb25zdCBkYXRlVGltZUNvbXBvbmVudCA9IGRhdGVDb21wb25lbnQuY2xvbmUoKTtcbiAgICBpZiAodGltZUNvbXBvbmVudC5pc0NlcnRhaW4oXCJob3VyXCIpKSB7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcImhvdXJcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJob3VyXCIpKTtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuYXNzaWduKFwibWludXRlXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWludXRlXCIpKTtcbiAgICAgICAgaWYgKHRpbWVDb21wb25lbnQuaXNDZXJ0YWluKFwic2Vjb25kXCIpKSB7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5hc3NpZ24oXCJzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJzZWNvbmRcIikpO1xuICAgICAgICAgICAgaWYgKHRpbWVDb21wb25lbnQuaXNDZXJ0YWluKFwibWlsbGlzZWNvbmRcIikpIHtcbiAgICAgICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5hc3NpZ24oXCJtaWxsaXNlY29uZFwiLCB0aW1lQ29tcG9uZW50LmdldChcIm1pbGxpc2Vjb25kXCIpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtaWxsaXNlY29uZFwiKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcInNlY29uZFwiLCB0aW1lQ29tcG9uZW50LmdldChcInNlY29uZFwiKSk7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWlsbGlzZWNvbmRcIikpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJob3VyXCIpKTtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtaW51dGVcIikpO1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcInNlY29uZFwiLCB0aW1lQ29tcG9uZW50LmdldChcInNlY29uZFwiKSk7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtaWxsaXNlY29uZFwiKSk7XG4gICAgfVxuICAgIGlmICh0aW1lQ29tcG9uZW50LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIHRpbWVDb21wb25lbnQuZ2V0KFwidGltZXpvbmVPZmZzZXRcIikpO1xuICAgIH1cbiAgICBjb25zdCBkYXRlSGFzTWVhbmluZ2Z1bE1lcmlkaWVtID0gZGF0ZUNvbXBvbmVudC5nZXQoXCJtZXJpZGllbVwiKSAhPSBudWxsICYmXG4gICAgICAgIChkYXRlQ29tcG9uZW50LmlzQ2VydGFpbihcIm1lcmlkaWVtXCIpIHx8XG4gICAgICAgICAgICBBcnJheS5mcm9tKGRhdGVDb21wb25lbnQudGFncygpKS5zb21lKCh0KSA9PiB0LnN0YXJ0c1dpdGgoXCJjYXN1YWxSZWZlcmVuY2UvXCIpKSk7XG4gICAgaWYgKHRpbWVDb21wb25lbnQuaXNDZXJ0YWluKFwibWVyaWRpZW1cIikpIHtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuYXNzaWduKFwibWVyaWRpZW1cIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtZXJpZGllbVwiKSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHRpbWVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikgIT0gbnVsbCAmJiAhZGF0ZUhhc01lYW5pbmdmdWxNZXJpZGllbSkge1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcIm1lcmlkaWVtXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikpO1xuICAgIH1cbiAgICBpZiAoZGF0ZVRpbWVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikgPT0gTWVyaWRpZW0uUE0gJiYgZGF0ZVRpbWVDb21wb25lbnQuZ2V0KFwiaG91clwiKSA8IDEyKSB7XG4gICAgICAgIGlmICh0aW1lQ29tcG9uZW50LmlzQ2VydGFpbihcImhvdXJcIikpIHtcbiAgICAgICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcImhvdXJcIiwgZGF0ZVRpbWVDb21wb25lbnQuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmltcGx5KFwiaG91clwiLCBkYXRlVGltZUNvbXBvbmVudC5nZXQoXCJob3VyXCIpICsgMTIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGRhdGVUaW1lQ29tcG9uZW50LmFkZFRhZ3MoZGF0ZUNvbXBvbmVudC50YWdzKCkpO1xuICAgIGRhdGVUaW1lQ29tcG9uZW50LmFkZFRhZ3ModGltZUNvbXBvbmVudC50YWdzKCkpO1xuICAgIHJldHVybiBkYXRlVGltZUNvbXBvbmVudDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW1lcmdpbmdDYWxjdWxhdGlvbi5qcy5tYXAiLCJpbXBvcnQgeyBNZXJnaW5nUmVmaW5lciB9IGZyb20gXCIuLi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5pbXBvcnQgeyBtZXJnZURhdGVUaW1lUmVzdWx0IH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL21lcmdpbmdDYWxjdWxhdGlvbi5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lciBleHRlbmRzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICBzaG91bGRNZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuICgoKGN1cnJlbnRSZXN1bHQuc3RhcnQuaXNPbmx5RGF0ZSgpICYmIG5leHRSZXN1bHQuc3RhcnQuaXNPbmx5VGltZSgpKSB8fFxuICAgICAgICAgICAgKG5leHRSZXN1bHQuc3RhcnQuaXNPbmx5RGF0ZSgpICYmIGN1cnJlbnRSZXN1bHQuc3RhcnQuaXNPbmx5VGltZSgpKSkgJiZcbiAgICAgICAgICAgIHRleHRCZXR3ZWVuLm1hdGNoKHRoaXMucGF0dGVybkJldHdlZW4oKSkgIT0gbnVsbCk7XG4gICAgfVxuICAgIG1lcmdlUmVzdWx0cyh0ZXh0QmV0d2VlbiwgY3VycmVudFJlc3VsdCwgbmV4dFJlc3VsdCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjdXJyZW50UmVzdWx0LnN0YXJ0LmlzT25seURhdGUoKVxuICAgICAgICAgICAgPyBtZXJnZURhdGVUaW1lUmVzdWx0KGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpXG4gICAgICAgICAgICA6IG1lcmdlRGF0ZVRpbWVSZXN1bHQobmV4dFJlc3VsdCwgY3VycmVudFJlc3VsdCk7XG4gICAgICAgIHJlc3VsdC5pbmRleCA9IGN1cnJlbnRSZXN1bHQuaW5kZXg7XG4gICAgICAgIHJlc3VsdC50ZXh0ID0gY3VycmVudFJlc3VsdC50ZXh0ICsgdGV4dEJldHdlZW4gKyBuZXh0UmVzdWx0LnRleHQ7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9QWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgQWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lciBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3JlZmluZXJzL0Fic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTWVyZ2VEYXRlVGltZVJlZmluZXIgZXh0ZW5kcyBBYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyIHtcbiAgICBwYXR0ZXJuQmV0d2VlbigpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoXCJeXFxcXHMqKFR8YXR8YWZ0ZXJ8YmVmb3JlfG9ufG9mfCx8LXxcXFxcLnziiJl8Oik/XFxcXHMqJFwiKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IHRvVGltZXpvbmVPZmZzZXQgfSBmcm9tIFwiLi4vLi4vdGltZXpvbmUuanNcIjtcbmNvbnN0IFRJTUVaT05FX05BTUVfUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCJeXFxcXHMqLD9cXFxccypcXFxcKD8oW0EtWl17Miw0fSlcXFxcKT8oPz1cXFxcV3wkKVwiLCBcImlcIik7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lciB7XG4gICAgdGltZXpvbmVPdmVycmlkZXM7XG4gICAgY29uc3RydWN0b3IodGltZXpvbmVPdmVycmlkZXMpIHtcbiAgICAgICAgdGhpcy50aW1lem9uZU92ZXJyaWRlcyA9IHRpbWV6b25lT3ZlcnJpZGVzO1xuICAgIH1cbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICBjb25zdCB0aW1lem9uZU92ZXJyaWRlcyA9IGNvbnRleHQub3B0aW9uLnRpbWV6b25lcyA/PyB7fTtcbiAgICAgICAgcmVzdWx0cy5mb3JFYWNoKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcocmVzdWx0LmluZGV4ICsgcmVzdWx0LnRleHQubGVuZ3RoKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gVElNRVpPTkVfTkFNRV9QQVRURVJOLmV4ZWMoc3VmZml4KTtcbiAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0aW1lem9uZUFiYnIgPSBtYXRjaFsxXS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICAgICAgY29uc3QgcmVmRGF0ZSA9IHJlc3VsdC5zdGFydC5kYXRlKCkgPz8gcmVzdWx0LnJlZkRhdGUgPz8gbmV3IERhdGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHR6T3ZlcnJpZGVzID0geyAuLi50aGlzLnRpbWV6b25lT3ZlcnJpZGVzLCAuLi50aW1lem9uZU92ZXJyaWRlcyB9O1xuICAgICAgICAgICAgY29uc3QgZXh0cmFjdGVkVGltZXpvbmVPZmZzZXQgPSB0b1RpbWV6b25lT2Zmc2V0KHRpbWV6b25lQWJiciwgcmVmRGF0ZSwgdHpPdmVycmlkZXMpO1xuICAgICAgICAgICAgaWYgKGV4dHJhY3RlZFRpbWV6b25lT2Zmc2V0ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXh0cmFjdGluZyB0aW1lem9uZTogJyR7dGltZXpvbmVBYmJyfScgaW50bzogJHtleHRyYWN0ZWRUaW1lem9uZU9mZnNldH0gZm9yOiAke3Jlc3VsdC5zdGFydH1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudFRpbWV6b25lT2Zmc2V0ID0gcmVzdWx0LnN0YXJ0LmdldChcInRpbWV6b25lT2Zmc2V0XCIpO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRUaW1lem9uZU9mZnNldCAhPT0gbnVsbCAmJiBleHRyYWN0ZWRUaW1lem9uZU9mZnNldCAhPSBjdXJyZW50VGltZXpvbmVPZmZzZXQpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRpbWV6b25lQWJiciAhPSBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc09ubHlEYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGltZXpvbmVBYmJyICE9IG1hdGNoWzFdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQudGV4dCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIGV4dHJhY3RlZFRpbWV6b25lT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXN1bHQuZW5kICE9IG51bGwgJiYgIXJlc3VsdC5lbmQuaXNDZXJ0YWluKFwidGltZXpvbmVPZmZzZXRcIikpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIGV4dHJhY3RlZFRpbWV6b25lT2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUV4dHJhY3RUaW1lem9uZUFiYnJSZWZpbmVyLmpzLm1hcCIsImNvbnN0IFRJTUVaT05FX09GRlNFVF9QQVRURVJOID0gbmV3IFJlZ0V4cChcIl5cXFxccyooPzpcXFxcKD8oPzpHTVR8VVRDKVxcXFxzPyk/KFsrLV0pKFxcXFxkezEsMn0pKD86Oj8oXFxcXGR7Mn0pKT9cXFxcKT9cIiwgXCJpXCIpO1xuY29uc3QgVElNRVpPTkVfT0ZGU0VUX1NJR05fR1JPVVAgPSAxO1xuY29uc3QgVElNRVpPTkVfT0ZGU0VUX0hPVVJfT0ZGU0VUX0dST1VQID0gMjtcbmNvbnN0IFRJTUVaT05FX09GRlNFVF9NSU5VVEVfT0ZGU0VUX0dST1VQID0gMztcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEV4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIge1xuICAgIHJlZmluZShjb250ZXh0LCByZXN1bHRzKSB7XG4gICAgICAgIHJlc3VsdHMuZm9yRWFjaChmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3VmZml4ID0gY29udGV4dC50ZXh0LnN1YnN0cmluZyhyZXN1bHQuaW5kZXggKyByZXN1bHQudGV4dC5sZW5ndGgpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBUSU1FWk9ORV9PRkZTRVRfUEFUVEVSTi5leGVjKHN1ZmZpeCk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEV4dHJhY3RpbmcgdGltZXpvbmU6ICcke21hdGNoWzBdfScgaW50byA6ICR7cmVzdWx0fWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBob3VyT2Zmc2V0ID0gcGFyc2VJbnQobWF0Y2hbVElNRVpPTkVfT0ZGU0VUX0hPVVJfT0ZGU0VUX0dST1VQXSk7XG4gICAgICAgICAgICBjb25zdCBtaW51dGVPZmZzZXQgPSBwYXJzZUludChtYXRjaFtUSU1FWk9ORV9PRkZTRVRfTUlOVVRFX09GRlNFVF9HUk9VUF0gfHwgXCIwXCIpO1xuICAgICAgICAgICAgbGV0IHRpbWV6b25lT2Zmc2V0ID0gaG91ck9mZnNldCAqIDYwICsgbWludXRlT2Zmc2V0O1xuICAgICAgICAgICAgaWYgKHRpbWV6b25lT2Zmc2V0ID4gMTQgKiA2MCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFtUSU1FWk9ORV9PRkZTRVRfU0lHTl9HUk9VUF0gPT09IFwiLVwiKSB7XG4gICAgICAgICAgICAgICAgdGltZXpvbmVPZmZzZXQgPSAtdGltZXpvbmVPZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCB0aW1lem9uZU9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwidGltZXpvbmVPZmZzZXRcIiwgdGltZXpvbmVPZmZzZXQpO1xuICAgICAgICAgICAgcmVzdWx0LnRleHQgKz0gbWF0Y2hbMF07XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyLmpzLm1hcCIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIE92ZXJsYXBSZW1vdmFsUmVmaW5lciB7XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZmlsdGVyZWRSZXN1bHRzID0gW107XG4gICAgICAgIGxldCBwcmV2UmVzdWx0ID0gcmVzdWx0c1swXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCByZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSByZXN1bHRzW2ldO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5pbmRleCA+PSBwcmV2UmVzdWx0LmluZGV4ICsgcHJldlJlc3VsdC50ZXh0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGZpbHRlcmVkUmVzdWx0cy5wdXNoKHByZXZSZXN1bHQpO1xuICAgICAgICAgICAgICAgIHByZXZSZXN1bHQgPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQga2VwdCA9IG51bGw7XG4gICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IG51bGw7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnRleHQubGVuZ3RoID4gcHJldlJlc3VsdC50ZXh0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGtlcHQgPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHByZXZSZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBrZXB0ID0gcHJldlJlc3VsdDtcbiAgICAgICAgICAgICAgICByZW1vdmVkID0gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSByZW1vdmUgJHtyZW1vdmVkfSBieSAke2tlcHR9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHByZXZSZXN1bHQgPSBrZXB0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcmV2UmVzdWx0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIGZpbHRlcmVkUmVzdWx0cy5wdXNoKHByZXZSZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWx0ZXJlZFJlc3VsdHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9T3ZlcmxhcFJlbW92YWxSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IFdlZWtkYXkgfSBmcm9tIFwiLi4vdHlwZXMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uL3Jlc3VsdHMuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXJzaW5nQ29tcG9uZW50c0F0V2Vla2RheShyZWZlcmVuY2UsIHdlZWtkYXksIG1vZGlmaWVyKSB7XG4gICAgY29uc3QgcmVmRGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICBjb25zdCBkYXlzVG9XZWVrZGF5ID0gZ2V0RGF5c1RvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5LCBtb2RpZmllcik7XG4gICAgbGV0IGNvbXBvbmVudHMgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlKTtcbiAgICBjb21wb25lbnRzID0gY29tcG9uZW50cy5hZGREdXJhdGlvbkFzSW1wbGllZCh7IGRheTogZGF5c1RvV2Vla2RheSB9KTtcbiAgICBjb21wb25lbnRzLmFzc2lnbihcIndlZWtkYXlcIiwgd2Vla2RheSk7XG4gICAgcmV0dXJuIGNvbXBvbmVudHM7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0RGF5c1RvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5LCBtb2RpZmllcikge1xuICAgIGNvbnN0IHJlZldlZWtkYXkgPSByZWZEYXRlLmdldERheSgpO1xuICAgIHN3aXRjaCAobW9kaWZpZXIpIHtcbiAgICAgICAgY2FzZSBcInRoaXNcIjpcbiAgICAgICAgICAgIHJldHVybiBnZXREYXlzRm9yd2FyZFRvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5KTtcbiAgICAgICAgY2FzZSBcImxhc3RcIjpcbiAgICAgICAgICAgIHJldHVybiBnZXRCYWNrd2FyZERheXNUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSk7XG4gICAgICAgIGNhc2UgXCJuZXh0XCI6XG4gICAgICAgICAgICBpZiAocmVmV2Vla2RheSA9PSBXZWVrZGF5LlNVTkRBWSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB3ZWVrZGF5ID09IFdlZWtkYXkuU1VOREFZID8gNyA6IHdlZWtkYXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVmV2Vla2RheSA9PSBXZWVrZGF5LlNBVFVSREFZKSB7XG4gICAgICAgICAgICAgICAgaWYgKHdlZWtkYXkgPT0gV2Vla2RheS5TQVRVUkRBWSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDc7XG4gICAgICAgICAgICAgICAgaWYgKHdlZWtkYXkgPT0gV2Vla2RheS5TVU5EQVkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiA4O1xuICAgICAgICAgICAgICAgIHJldHVybiAxICsgd2Vla2RheTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh3ZWVrZGF5IDwgcmVmV2Vla2RheSAmJiB3ZWVrZGF5ICE9IFdlZWtkYXkuU1VOREFZKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpICsgNztcbiAgICAgICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGdldERheXNUb1dlZWtkYXlDbG9zZXN0KHJlZkRhdGUsIHdlZWtkYXkpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldERheXNUb1dlZWtkYXlDbG9zZXN0KHJlZkRhdGUsIHdlZWtkYXkpIHtcbiAgICBjb25zdCBiYWNrd2FyZCA9IGdldEJhY2t3YXJkRGF5c1RvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5KTtcbiAgICBjb25zdCBmb3J3YXJkID0gZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSk7XG4gICAgcmV0dXJuIGZvcndhcmQgPCAtYmFja3dhcmQgPyBmb3J3YXJkIDogYmFja3dhcmQ7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSkge1xuICAgIGNvbnN0IHJlZldlZWtkYXkgPSByZWZEYXRlLmdldERheSgpO1xuICAgIGxldCBmb3J3YXJkQ291bnQgPSB3ZWVrZGF5IC0gcmVmV2Vla2RheTtcbiAgICBpZiAoZm9yd2FyZENvdW50IDwgMCkge1xuICAgICAgICBmb3J3YXJkQ291bnQgKz0gNztcbiAgICB9XG4gICAgcmV0dXJuIGZvcndhcmRDb3VudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXRCYWNrd2FyZERheXNUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSkge1xuICAgIGNvbnN0IHJlZldlZWtkYXkgPSByZWZEYXRlLmdldERheSgpO1xuICAgIGxldCBiYWNrd2FyZENvdW50ID0gd2Vla2RheSAtIHJlZldlZWtkYXk7XG4gICAgaWYgKGJhY2t3YXJkQ291bnQgPj0gMCkge1xuICAgICAgICBiYWNrd2FyZENvdW50IC09IDc7XG4gICAgfVxuICAgIHJldHVybiBiYWNrd2FyZENvdW50O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9d2Vla2RheXMuanMubWFwIiwiaW1wb3J0ICogYXMgZGF0ZXMgZnJvbSBcIi4uLy4uL3V0aWxzL2RhdGVzLmpzXCI7XG5pbXBvcnQgeyBpbXBseVNpbWlsYXJEYXRlIH0gZnJvbSBcIi4uLy4uL3V0aWxzL2RhdGVzLmpzXCI7XG5pbXBvcnQgeyBhZGREdXJhdGlvbiB9IGZyb20gXCIuLi8uLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuaW1wb3J0IHsgZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkgfSBmcm9tIFwiLi4vLi4vY2FsY3VsYXRpb24vd2Vla2RheXMuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvcndhcmREYXRlUmVmaW5lciB7XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Lm9wdGlvbi5mb3J3YXJkRGF0ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0cy5mb3JFYWNoKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGxldCByZWZEYXRlID0gY29udGV4dC5yZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzT25seVRpbWUoKSAmJiBjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50ID4gcmVzdWx0LnN0YXJ0LmRhdGUoKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZkRhdGUgPSBjb250ZXh0LnJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZWZGb2xsb3dpbmdEYXkgPSBuZXcgRGF0ZShyZWZEYXRlKTtcbiAgICAgICAgICAgICAgICByZWZGb2xsb3dpbmdEYXkuc2V0RGF0ZShyZWZGb2xsb3dpbmdEYXkuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgZGF0ZXMuaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuc3RhcnQsIHJlZkZvbGxvd2luZ0RheSk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gYWRqdXN0ZWQgJHtyZXN1bHR9IHRpbWUgZnJvbSB0aGUgcmVmIGRhdGUgKCR7cmVmRGF0ZX0pIHRvIHRoZSBmb2xsb3dpbmcgZGF5ICgke3JlZkZvbGxvd2luZ0RheX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5lbmQgJiYgcmVzdWx0LmVuZC5pc09ubHlUaW1lKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0ZXMuaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuZW5kLCByZWZGb2xsb3dpbmdEYXkpO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmRhdGUoKSA+IHJlc3VsdC5lbmQuZGF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWZGb2xsb3dpbmdEYXkuc2V0RGF0ZShyZWZGb2xsb3dpbmdEYXkuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRlcy5pbXBseVNpbWlsYXJEYXRlKHJlc3VsdC5lbmQsIHJlZkZvbGxvd2luZ0RheSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSAmJiByZWZEYXRlID4gcmVzdWx0LnN0YXJ0LmRhdGUoKSkge1xuICAgICAgICAgICAgICAgIGxldCBkYXlzVG9BZGQgPSBnZXREYXlzRm9yd2FyZFRvV2Vla2RheShyZWZEYXRlLCByZXN1bHQuc3RhcnQuZ2V0KFwid2Vla2RheVwiKSkgfHwgNztcbiAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkZWRXZWVrZGF5ID0gYWRkRHVyYXRpb24ocmVmRGF0ZSwgeyBkYXk6IGRheXNUb0FkZCB9KTtcbiAgICAgICAgICAgICAgICBpbXBseVNpbWlsYXJEYXRlKHJlc3VsdC5zdGFydCwgZm9yd2FyZGVkV2Vla2RheSk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gYWRqdXN0ZWQgJHtyZXN1bHR9IHdlZWtkYXkgKCR7cmVzdWx0LnN0YXJ0fSlgKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAmJiByZXN1bHQuc3RhcnQuZGF0ZSgpID4gcmVzdWx0LmVuZC5kYXRlKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRheXNUb0FkZCA9IGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHJlc3VsdC5zdGFydC5nZXQoXCJ3ZWVrZGF5XCIpKSB8fCA3O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3J3YXJkZWRXZWVrZGF5ID0gYWRkRHVyYXRpb24ocmVmRGF0ZSwgeyBkYXk6IGRheXNUb0FkZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuZW5kLCBmb3J3YXJkZWRXZWVrZGF5KTtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGFkanVzdGVkICR7cmVzdWx0fSB3ZWVrZGF5ICgke3Jlc3VsdC5lbmR9KWApO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzRGF0ZVdpdGhVbmtub3duWWVhcigpICYmIHJlZkRhdGUgPiByZXN1bHQuc3RhcnQuZGF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzICYmIHJlZkRhdGUgPiByZXN1bHQuc3RhcnQuZGF0ZSgpOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCByZXN1bHQuc3RhcnQuZ2V0KFwieWVhclwiKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gYWRqdXN0ZWQgJHtyZXN1bHR9IHllYXIgKCR7cmVzdWx0LnN0YXJ0fSlgKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuZW5kICYmICFyZXN1bHQuZW5kLmlzQ2VydGFpbihcInllYXJcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5lbmQuaW1wbHkoXCJ5ZWFyXCIsIHJlc3VsdC5lbmQuZ2V0KFwieWVhclwiKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBhZGp1c3RlZCAke3Jlc3VsdH0gbW9udGggKCR7cmVzdWx0LnN0YXJ0fSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Rm9yd2FyZERhdGVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IEZpbHRlciB9IGZyb20gXCIuLi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBVbmxpa2VseUZvcm1hdEZpbHRlciBleHRlbmRzIEZpbHRlciB7XG4gICAgc3RyaWN0TW9kZTtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIGlzVmFsaWQoY29udGV4dCwgcmVzdWx0KSB7XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5yZXBsYWNlKFwiIFwiLCBcIlwiKS5tYXRjaCgvXlxcZCooXFwuXFxkKik/JC8pKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVtb3ZpbmcgdW5saWtlbHkgcmVzdWx0ICcke3Jlc3VsdC50ZXh0fSdgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcmVzdWx0LnN0YXJ0LmlzVmFsaWREYXRlKCkpIHtcbiAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSZW1vdmluZyBpbnZhbGlkIHJlc3VsdDogJHtyZXN1bHR9ICgke3Jlc3VsdC5zdGFydH0pYCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0LmVuZCAmJiAhcmVzdWx0LmVuZC5pc1ZhbGlkRGF0ZSgpKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVtb3ZpbmcgaW52YWxpZCByZXN1bHQ6ICR7cmVzdWx0fSAoJHtyZXN1bHQuZW5kfSlgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0cmljdE1vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzU3RyaWN0TW9kZVZhbGlkKGNvbnRleHQsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlzU3RyaWN0TW9kZVZhbGlkKGNvbnRleHQsIHJlc3VsdCkge1xuICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSkge1xuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYChTdHJpY3QpIFJlbW92aW5nIHdlZWtkYXkgb25seSBjb21wb25lbnQ6ICR7cmVzdWx0fSAoJHtyZXN1bHQuZW5kfSlgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVVubGlrZWx5Rm9ybWF0RmlsdGVyLmpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4vQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIihbMC05XXs0fSlcXFxcLShbMC05XXsxLDJ9KVxcXFwtKFswLTldezEsMn0pXCIgK1xuICAgIFwiKD86VFwiICtcbiAgICBcIihbMC05XXsxLDJ9KTooWzAtOV17MSwyfSlcIiArXG4gICAgXCIoPzpcIiArXG4gICAgXCI6KFswLTldezEsMn0pKD86XFxcXC4oXFxcXGR7MSw0fSkpP1wiICtcbiAgICBcIik/XCIgK1xuICAgIFwiKFwiICtcbiAgICBcIlp8KFsrLV1cXFxcZHsyfSk6PyhcXFxcZHsyfSk/XCIgK1xuICAgIFwiKT9cIiArXG4gICAgXCIpP1wiICtcbiAgICBcIig/PVxcXFxXfCQpXCIsIFwiaVwiKTtcbmNvbnN0IFlFQVJfTlVNQkVSX0dST1VQID0gMTtcbmNvbnN0IE1PTlRIX05VTUJFUl9HUk9VUCA9IDI7XG5jb25zdCBEQVRFX05VTUJFUl9HUk9VUCA9IDM7XG5jb25zdCBIT1VSX05VTUJFUl9HUk9VUCA9IDQ7XG5jb25zdCBNSU5VVEVfTlVNQkVSX0dST1VQID0gNTtcbmNvbnN0IFNFQ09ORF9OVU1CRVJfR1JPVVAgPSA2O1xuY29uc3QgTUlMTElTRUNPTkRfTlVNQkVSX0dST1VQID0gNztcbmNvbnN0IFRaRF9HUk9VUCA9IDg7XG5jb25zdCBUWkRfSE9VUl9PRkZTRVRfR1JPVVAgPSA5O1xuY29uc3QgVFpEX01JTlVURV9PRkZTRVRfR1JPVVAgPSAxMDtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIElTT0Zvcm1hdFBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoe1xuICAgICAgICAgICAgXCJ5ZWFyXCI6IHBhcnNlSW50KG1hdGNoW1lFQVJfTlVNQkVSX0dST1VQXSksXG4gICAgICAgICAgICBcIm1vbnRoXCI6IHBhcnNlSW50KG1hdGNoW01PTlRIX05VTUJFUl9HUk9VUF0pLFxuICAgICAgICAgICAgXCJkYXlcIjogcGFyc2VJbnQobWF0Y2hbREFURV9OVU1CRVJfR1JPVVBdKSxcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChtYXRjaFtIT1VSX05VTUJFUl9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIHBhcnNlSW50KG1hdGNoW0hPVVJfTlVNQkVSX0dST1VQXSkpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtaW51dGVcIiwgcGFyc2VJbnQobWF0Y2hbTUlOVVRFX05VTUJFUl9HUk9VUF0pKTtcbiAgICAgICAgICAgIGlmIChtYXRjaFtTRUNPTkRfTlVNQkVSX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJzZWNvbmRcIiwgcGFyc2VJbnQobWF0Y2hbU0VDT05EX05VTUJFUl9HUk9VUF0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFtNSUxMSVNFQ09ORF9OVU1CRVJfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1pbGxpc2Vjb25kXCIsIHBhcnNlSW50KG1hdGNoW01JTExJU0VDT05EX05VTUJFUl9HUk9VUF0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFtUWkRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hbVFpEX0hPVVJfT0ZGU0VUX0dST1VQXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBob3VyT2Zmc2V0ID0gcGFyc2VJbnQobWF0Y2hbVFpEX0hPVVJfT0ZGU0VUX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgICAgIGxldCBtaW51dGVPZmZzZXQgPSAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hbVFpEX01JTlVURV9PRkZTRVRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pbnV0ZU9mZnNldCA9IHBhcnNlSW50KG1hdGNoW1RaRF9NSU5VVEVfT0ZGU0VUX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ID0gaG91ck9mZnNldCAqIDYwO1xuICAgICAgICAgICAgICAgICAgICBpZiAob2Zmc2V0IDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb2Zmc2V0IC09IG1pbnV0ZU9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldCArPSBtaW51dGVPZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCBvZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnRzLmFkZFRhZyhcInBhcnNlci9JU09Gb3JtYXRQYXJzZXJcIik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9SVNPRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uL2Fic3RyYWN0UmVmaW5lcnMuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIgZXh0ZW5kcyBNZXJnaW5nUmVmaW5lciB7XG4gICAgbWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IG5ld1Jlc3VsdCA9IG5leHRSZXN1bHQuY2xvbmUoKTtcbiAgICAgICAgbmV3UmVzdWx0LmluZGV4ID0gY3VycmVudFJlc3VsdC5pbmRleDtcbiAgICAgICAgbmV3UmVzdWx0LnRleHQgPSBjdXJyZW50UmVzdWx0LnRleHQgKyB0ZXh0QmV0d2VlbiArIG5ld1Jlc3VsdC50ZXh0O1xuICAgICAgICBuZXdSZXN1bHQuc3RhcnQuYXNzaWduKFwid2Vla2RheVwiLCBjdXJyZW50UmVzdWx0LnN0YXJ0LmdldChcIndlZWtkYXlcIikpO1xuICAgICAgICBpZiAobmV3UmVzdWx0LmVuZCkge1xuICAgICAgICAgICAgbmV3UmVzdWx0LmVuZC5hc3NpZ24oXCJ3ZWVrZGF5XCIsIGN1cnJlbnRSZXN1bHQuc3RhcnQuZ2V0KFwid2Vla2RheVwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ld1Jlc3VsdDtcbiAgICB9XG4gICAgc2hvdWxkTWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IHdlZWtkYXlUaGVuTm9ybWFsRGF0ZSA9IGN1cnJlbnRSZXN1bHQuc3RhcnQuaXNPbmx5V2Vla2RheUNvbXBvbmVudCgpICYmXG4gICAgICAgICAgICAhY3VycmVudFJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJob3VyXCIpICYmXG4gICAgICAgICAgICBuZXh0UmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcImRheVwiKTtcbiAgICAgICAgcmV0dXJuIHdlZWtkYXlUaGVuTm9ybWFsRGF0ZSAmJiB0ZXh0QmV0d2Vlbi5tYXRjaCgvXiw/XFxzKiQvKSAhPSBudWxsO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPU1lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIuanMubWFwIiwiaW1wb3J0IEV4dHJhY3RUaW1lem9uZUFiYnJSZWZpbmVyIGZyb20gXCIuL2NvbW1vbi9yZWZpbmVycy9FeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lci5qc1wiO1xuaW1wb3J0IEV4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL0V4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIuanNcIjtcbmltcG9ydCBPdmVybGFwUmVtb3ZhbFJlZmluZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL092ZXJsYXBSZW1vdmFsUmVmaW5lci5qc1wiO1xuaW1wb3J0IEZvcndhcmREYXRlUmVmaW5lciBmcm9tIFwiLi9jb21tb24vcmVmaW5lcnMvRm9yd2FyZERhdGVSZWZpbmVyLmpzXCI7XG5pbXBvcnQgVW5saWtlbHlGb3JtYXRGaWx0ZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL1VubGlrZWx5Rm9ybWF0RmlsdGVyLmpzXCI7XG5pbXBvcnQgSVNPRm9ybWF0UGFyc2VyIGZyb20gXCIuL2NvbW1vbi9wYXJzZXJzL0lTT0Zvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IE1lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL01lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBpbmNsdWRlQ29tbW9uQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uLCBzdHJpY3RNb2RlID0gZmFsc2UpIHtcbiAgICBjb25maWd1cmF0aW9uLnBhcnNlcnMudW5zaGlmdChuZXcgSVNPRm9ybWF0UGFyc2VyKCkpO1xuICAgIGNvbmZpZ3VyYXRpb24ucmVmaW5lcnMudW5zaGlmdChuZXcgTWVyZ2VXZWVrZGF5Q29tcG9uZW50UmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnVuc2hpZnQobmV3IEV4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy51bnNoaWZ0KG5ldyBPdmVybGFwUmVtb3ZhbFJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy5wdXNoKG5ldyBFeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnB1c2gobmV3IE92ZXJsYXBSZW1vdmFsUmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnB1c2gobmV3IEZvcndhcmREYXRlUmVmaW5lcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnB1c2gobmV3IFVubGlrZWx5Rm9ybWF0RmlsdGVyKHN0cmljdE1vZGUpKTtcbiAgICByZXR1cm4gY29uZmlndXJhdGlvbjtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvbmZpZ3VyYXRpb25zLmpzLm1hcCIsImltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IGFzc2lnblNpbWlsYXJEYXRlLCBhc3NpZ25TaW1pbGFyVGltZSwgaW1wbHlTaW1pbGFyVGltZSB9IGZyb20gXCIuLi91dGlscy9kYXRlcy5qc1wiO1xuaW1wb3J0IHsgTWVyaWRpZW0gfSBmcm9tIFwiLi4vdHlwZXMuanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBub3cocmVmZXJlbmNlKSB7XG4gICAgY29uc3QgdGFyZ2V0RGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBhc3NpZ25TaW1pbGFyVGltZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCByZWZlcmVuY2UuZ2V0VGltZXpvbmVPZmZzZXQoKSk7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS9ub3dcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0b2RheShyZWZlcmVuY2UpIHtcbiAgICBjb25zdCB0YXJnZXREYXRlID0gcmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGltcGx5U2ltaWxhclRpbWUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBjb21wb25lbnQuZGVsZXRlKFwibWVyaWRpZW1cIik7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS90b2RheVwiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHllc3RlcmRheShyZWZlcmVuY2UpIHtcbiAgICByZXR1cm4gdGhlRGF5QmVmb3JlKHJlZmVyZW5jZSwgMSkuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL3llc3RlcmRheVwiKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0b21vcnJvdyhyZWZlcmVuY2UpIHtcbiAgICByZXR1cm4gdGhlRGF5QWZ0ZXIocmVmZXJlbmNlLCAxKS5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvdG9tb3Jyb3dcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gdGhlRGF5QmVmb3JlKHJlZmVyZW5jZSwgbnVtRGF5KSB7XG4gICAgcmV0dXJuIHRoZURheUFmdGVyKHJlZmVyZW5jZSwgLW51bURheSk7XG59XG5leHBvcnQgZnVuY3Rpb24gdGhlRGF5QWZ0ZXIocmVmZXJlbmNlLCBuRGF5cykge1xuICAgIGNvbnN0IHRhcmdldERhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGNvbnN0IG5ld0RhdGUgPSBuZXcgRGF0ZSh0YXJnZXREYXRlLmdldFRpbWUoKSk7XG4gICAgbmV3RGF0ZS5zZXREYXRlKG5ld0RhdGUuZ2V0RGF0ZSgpICsgbkRheXMpO1xuICAgIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgbmV3RGF0ZSk7XG4gICAgaW1wbHlTaW1pbGFyVGltZShjb21wb25lbnQsIG5ld0RhdGUpO1xuICAgIGNvbXBvbmVudC5kZWxldGUoXCJtZXJpZGllbVwiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRvbmlnaHQocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAyMikge1xuICAgIGNvbnN0IHRhcmdldERhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0RGF0ZSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwiaG91clwiLCBpbXBseUhvdXIpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICBjb21wb25lbnQuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL3RvbmlnaHRcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBsYXN0TmlnaHQocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAwKSB7XG4gICAgbGV0IHRhcmdldERhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGlmICh0YXJnZXREYXRlLmdldEhvdXJzKCkgPCA2KSB7XG4gICAgICAgIHRhcmdldERhdGUgPSBuZXcgRGF0ZSh0YXJnZXREYXRlLmdldFRpbWUoKSAtIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgIH1cbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGV2ZW5pbmcocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAyMCkge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwiaG91clwiLCBpbXBseUhvdXIpO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvZXZlbmluZ1wiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHllc3RlcmRheUV2ZW5pbmcocmVmZXJlbmNlLCBpbXBseUhvdXIgPSAyMCkge1xuICAgIGxldCB0YXJnZXREYXRlID0gcmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICB0YXJnZXREYXRlID0gbmV3IERhdGUodGFyZ2V0RGF0ZS5nZXRUaW1lKCkgLSAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS95ZXN0ZXJkYXlcIik7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS9ldmVuaW5nXCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gbWlkbmlnaHQocmVmZXJlbmNlKSB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGlmIChyZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCkuZ2V0SG91cnMoKSA+IDIpIHtcbiAgICAgICAgY29tcG9uZW50LmFkZER1cmF0aW9uQXNJbXBsaWVkKHsgZGF5OiAxIH0pO1xuICAgIH1cbiAgICBjb21wb25lbnQuYXNzaWduKFwiaG91clwiLCAwKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvbWlkbmlnaHRcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtb3JuaW5nKHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gNikge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwiaG91clwiLCBpbXBseUhvdXIpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbnV0ZVwiLCAwKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJzZWNvbmRcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgMCk7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS9tb3JuaW5nXCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gYWZ0ZXJub29uKHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gMTUpIHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvYWZ0ZXJub29uXCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gbm9vbihyZWZlcmVuY2UpIHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uQU0pO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJob3VyXCIsIDEyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2Uvbm9vblwiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2FzdWFsUmVmZXJlbmNlcy5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IGFzc2lnblNpbWlsYXJEYXRlIH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL2RhdGVzLmpzXCI7XG5pbXBvcnQgKiBhcyByZWZlcmVuY2VzIGZyb20gXCIuLi8uLi8uLi9jb21tb24vY2FzdWFsUmVmZXJlbmNlcy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IC8obm93fHRvZGF5fHRvbmlnaHR8dG9tb3Jyb3d8b3Zlcm1vcnJvd3x0bXJ8dG1yd3x5ZXN0ZXJkYXl8bGFzdFxccypuaWdodCkoPz1cXFd8JCkvaTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOQ2FzdWFsRGF0ZVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oY29udGV4dCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGxldCB0YXJnZXREYXRlID0gY29udGV4dC5yZWZEYXRlO1xuICAgICAgICBjb25zdCBsb3dlclRleHQgPSBtYXRjaFswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBsZXQgY29tcG9uZW50ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cygpO1xuICAgICAgICBzd2l0Y2ggKGxvd2VyVGV4dCkge1xuICAgICAgICAgICAgY2FzZSBcIm5vd1wiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMubm93KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJ0b2RheVwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMudG9kYXkoY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcInllc3RlcmRheVwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMueWVzdGVyZGF5KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJ0b21vcnJvd1wiOlxuICAgICAgICAgICAgY2FzZSBcInRtclwiOlxuICAgICAgICAgICAgY2FzZSBcInRtcndcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSByZWZlcmVuY2VzLnRvbW9ycm93KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJ0b25pZ2h0XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gcmVmZXJlbmNlcy50b25pZ2h0KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJvdmVybW9ycm93XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gcmVmZXJlbmNlcy50aGVEYXlBZnRlcihjb250ZXh0LnJlZmVyZW5jZSwgMik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGlmIChsb3dlclRleHQubWF0Y2goL2xhc3RcXHMqbmlnaHQvKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0RGF0ZS5nZXRIb3VycygpID4gNikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJldmlvdXNEYXkgPSBuZXcgRGF0ZSh0YXJnZXREYXRlLmdldFRpbWUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aW91c0RheS5zZXREYXRlKHByZXZpb3VzRGF5LmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0RGF0ZSA9IHByZXZpb3VzRGF5O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0RGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbXBvbmVudC5hZGRUYWcoXCJwYXJzZXIvRU5DYXN1YWxEYXRlUGFyc2VyXCIpO1xuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOQ2FzdWFsRGF0ZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCAqIGFzIGNhc3VhbFJlZmVyZW5jZXMgZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9jYXN1YWxSZWZlcmVuY2VzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gLyg/OnRoaXMpP1xcc3swLDN9KG1vcm5pbmd8YWZ0ZXJub29ufGV2ZW5pbmd8bmlnaHR8bWlkbmlnaHR8bWlkZGF5fG5vb24pKD89XFxXfCQpL2k7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTkNhc3VhbFRpbWVQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGxldCBjb21wb25lbnQgPSBudWxsO1xuICAgICAgICBzd2l0Y2ggKG1hdGNoWzFdLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIGNhc2UgXCJhZnRlcm5vb25cIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSBjYXN1YWxSZWZlcmVuY2VzLmFmdGVybm9vbihjb250ZXh0LnJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZXZlbmluZ1wiOlxuICAgICAgICAgICAgY2FzZSBcIm5pZ2h0XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gY2FzdWFsUmVmZXJlbmNlcy5ldmVuaW5nKGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJtaWRuaWdodFwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IGNhc3VhbFJlZmVyZW5jZXMubWlkbmlnaHQoY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIm1vcm5pbmdcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSBjYXN1YWxSZWZlcmVuY2VzLm1vcm5pbmcoY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIm5vb25cIjpcbiAgICAgICAgICAgIGNhc2UgXCJtaWRkYXlcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSBjYXN1YWxSZWZlcmVuY2VzLm5vb24oY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5hZGRUYWcoXCJwYXJzZXIvRU5DYXN1YWxUaW1lUGFyc2VyXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5DYXN1YWxUaW1lUGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IFdFRUtEQVlfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IGNyZWF0ZVBhcnNpbmdDb21wb25lbnRzQXRXZWVrZGF5IH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL3dlZWtkYXlzLmpzXCI7XG5pbXBvcnQgeyBXZWVrZGF5IH0gZnJvbSBcIi4uLy4uLy4uL3R5cGVzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIig/Oig/OlxcXFwsfFxcXFwofFxcXFzvvIgpXFxcXHMqKT9cIiArXG4gICAgXCIoPzpvblxcXFxzKj8pP1wiICtcbiAgICBcIig/Oih0aGlzfGxhc3R8cGFzdHxuZXh0KVxcXFxzKik/XCIgK1xuICAgIGAoJHttYXRjaEFueVBhdHRlcm4oV0VFS0RBWV9ESUNUSU9OQVJZKX18d2Vla2VuZHx3ZWVrZGF5KWAgK1xuICAgIFwiKD86XFxcXHMqKD86XFxcXCx8XFxcXCl8XFxcXO+8iSkpP1wiICtcbiAgICBcIig/OlxcXFxzKig/Om9mXFxcXHMqKT8odGhpc3xsYXN0fHBhc3R8bmV4dClcXFxccyp3ZWVrKT9cIiArXG4gICAgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBQUkVGSVhfR1JPVVAgPSAxO1xuY29uc3QgV0VFS0RBWV9HUk9VUCA9IDI7XG5jb25zdCBQT1NURklYX0dST1VQID0gMztcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOV2Vla2RheVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcHJlZml4ID0gbWF0Y2hbUFJFRklYX0dST1VQXTtcbiAgICAgICAgY29uc3QgcG9zdGZpeCA9IG1hdGNoW1BPU1RGSVhfR1JPVVBdO1xuICAgICAgICBsZXQgbW9kaWZpZXJXb3JkID0gcHJlZml4IHx8IHBvc3RmaXg7XG4gICAgICAgIG1vZGlmaWVyV29yZCA9IG1vZGlmaWVyV29yZCB8fCBcIlwiO1xuICAgICAgICBtb2RpZmllcldvcmQgPSBtb2RpZmllcldvcmQudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgbGV0IG1vZGlmaWVyID0gbnVsbDtcbiAgICAgICAgaWYgKG1vZGlmaWVyV29yZCA9PSBcImxhc3RcIiB8fCBtb2RpZmllcldvcmQgPT0gXCJwYXN0XCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJsYXN0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobW9kaWZpZXJXb3JkID09IFwibmV4dFwiKSB7XG4gICAgICAgICAgICBtb2RpZmllciA9IFwibmV4dFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1vZGlmaWVyV29yZCA9PSBcInRoaXNcIikge1xuICAgICAgICAgICAgbW9kaWZpZXIgPSBcInRoaXNcIjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB3ZWVrZGF5X3dvcmQgPSBtYXRjaFtXRUVLREFZX0dST1VQXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBsZXQgd2Vla2RheTtcbiAgICAgICAgaWYgKFdFRUtEQVlfRElDVElPTkFSWVt3ZWVrZGF5X3dvcmRdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHdlZWtkYXkgPSBXRUVLREFZX0RJQ1RJT05BUllbd2Vla2RheV93b3JkXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3ZWVrZGF5X3dvcmQgPT0gXCJ3ZWVrZW5kXCIpIHtcbiAgICAgICAgICAgIHdlZWtkYXkgPSBtb2RpZmllciA9PSBcImxhc3RcIiA/IFdlZWtkYXkuU1VOREFZIDogV2Vla2RheS5TQVRVUkRBWTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh3ZWVrZGF5X3dvcmQgPT0gXCJ3ZWVrZGF5XCIpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlZldlZWtkYXkgPSBjb250ZXh0LnJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKS5nZXREYXkoKTtcbiAgICAgICAgICAgIGlmIChyZWZXZWVrZGF5ID09IFdlZWtkYXkuU1VOREFZIHx8IHJlZldlZWtkYXkgPT0gV2Vla2RheS5TQVRVUkRBWSkge1xuICAgICAgICAgICAgICAgIHdlZWtkYXkgPSBtb2RpZmllciA9PSBcImxhc3RcIiA/IFdlZWtkYXkuRlJJREFZIDogV2Vla2RheS5NT05EQVk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICB3ZWVrZGF5ID0gcmVmV2Vla2RheSAtIDE7XG4gICAgICAgICAgICAgICAgd2Vla2RheSA9IG1vZGlmaWVyID09IFwibGFzdFwiID8gd2Vla2RheSAtIDEgOiB3ZWVrZGF5ICsgMTtcbiAgICAgICAgICAgICAgICB3ZWVrZGF5ID0gKHdlZWtkYXkgJSA1KSArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3JlYXRlUGFyc2luZ0NvbXBvbmVudHNBdFdlZWtkYXkoY29udGV4dC5yZWZlcmVuY2UsIHdlZWtkYXksIG1vZGlmaWVyKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTldlZWtkYXlQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgVElNRV9VTklUX0RJQ1RJT05BUlkgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cyB9IGZyb20gXCIuLi8uLi8uLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKHRoaXN8bGFzdHxwYXN0fG5leHR8YWZ0ZXJcXFxccyp0aGlzKVxcXFxzKigke21hdGNoQW55UGF0dGVybihUSU1FX1VOSVRfRElDVElPTkFSWSl9KSg/PVxcXFxzKilgICsgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBNT0RJRklFUl9XT1JEX0dST1VQID0gMTtcbmNvbnN0IFJFTEFUSVZFX1dPUkRfR1JPVVAgPSAyO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5SZWxhdGl2ZURhdGVGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IG1vZGlmaWVyID0gbWF0Y2hbTU9ESUZJRVJfV09SRF9HUk9VUF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgdW5pdFdvcmQgPSBtYXRjaFtSRUxBVElWRV9XT1JEX0dST1VQXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCB0aW1ldW5pdCA9IFRJTUVfVU5JVF9ESUNUSU9OQVJZW3VuaXRXb3JkXTtcbiAgICAgICAgaWYgKG1vZGlmaWVyID09IFwibmV4dFwiIHx8IG1vZGlmaWVyLnN0YXJ0c1dpdGgoXCJhZnRlclwiKSkge1xuICAgICAgICAgICAgY29uc3QgdGltZVVuaXRzID0ge307XG4gICAgICAgICAgICB0aW1lVW5pdHNbdGltZXVuaXRdID0gMTtcbiAgICAgICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHRpbWVVbml0cyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1vZGlmaWVyID09IFwibGFzdFwiIHx8IG1vZGlmaWVyID09IFwicGFzdFwiKSB7XG4gICAgICAgICAgICBjb25zdCB0aW1lVW5pdHMgPSB7fTtcbiAgICAgICAgICAgIHRpbWVVbml0c1t0aW1ldW5pdF0gPSAtMTtcbiAgICAgICAgICAgIHJldHVybiBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoY29udGV4dC5yZWZlcmVuY2UsIHRpbWVVbml0cyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoKTtcbiAgICAgICAgbGV0IGRhdGUgPSBuZXcgRGF0ZShjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50LmdldFRpbWUoKSk7XG4gICAgICAgIGlmICh1bml0V29yZC5tYXRjaCgvd2Vlay9pKSkge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gZGF0ZS5nZXREYXkoKSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodW5pdFdvcmQubWF0Y2goL21vbnRoL2kpKSB7XG4gICAgICAgICAgICBkYXRlLnNldERhdGUoMSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1bml0V29yZC5tYXRjaCgveWVhci9pKSkge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKDEpO1xuICAgICAgICAgICAgZGF0ZS5zZXRNb250aCgwKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5SZWxhdGl2ZURhdGVGb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgZmluZE1vc3RMaWtlbHlBRFllYXIsIGZpbmRZZWFyQ2xvc2VzdFRvUmVmIH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL3llYXJzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIihbXlxcXFxkXXxeKVwiICtcbiAgICBcIihbMC0zXXswLDF9WzAtOV17MX0pW1xcXFwvXFxcXC5cXFxcLV0oWzAtM117MCwxfVswLTldezF9KVwiICtcbiAgICBcIig/OltcXFxcL1xcXFwuXFxcXC1dKFswLTldezR9fFswLTldezJ9KSk/XCIgK1xuICAgIFwiKFxcXFxXfCQpXCIsIFwiaVwiKTtcbmNvbnN0IE9QRU5JTkdfR1JPVVAgPSAxO1xuY29uc3QgRU5ESU5HX0dST1VQID0gNTtcbmNvbnN0IEZJUlNUX05VTUJFUlNfR1JPVVAgPSAyO1xuY29uc3QgU0VDT05EX05VTUJFUlNfR1JPVVAgPSAzO1xuY29uc3QgWUVBUl9HUk9VUCA9IDQ7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBTbGFzaERhdGVGb3JtYXRQYXJzZXIge1xuICAgIGdyb3VwTnVtYmVyTW9udGg7XG4gICAgZ3JvdXBOdW1iZXJEYXk7XG4gICAgY29uc3RydWN0b3IobGl0dGxlRW5kaWFuKSB7XG4gICAgICAgIHRoaXMuZ3JvdXBOdW1iZXJNb250aCA9IGxpdHRsZUVuZGlhbiA/IFNFQ09ORF9OVU1CRVJTX0dST1VQIDogRklSU1RfTlVNQkVSU19HUk9VUDtcbiAgICAgICAgdGhpcy5ncm91cE51bWJlckRheSA9IGxpdHRsZUVuZGlhbiA/IEZJUlNUX05VTUJFUlNfR1JPVVAgOiBTRUNPTkRfTlVNQkVSU19HUk9VUDtcbiAgICB9XG4gICAgcGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoW09QRU5JTkdfR1JPVVBdLmxlbmd0aDtcbiAgICAgICAgY29uc3QgaW5kZXhFbmQgPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aCAtIG1hdGNoW0VORElOR19HUk9VUF0ubGVuZ3RoO1xuICAgICAgICBpZiAoaW5kZXggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0QmVmb3JlID0gY29udGV4dC50ZXh0LnN1YnN0cmluZygwLCBpbmRleCk7XG4gICAgICAgICAgICBpZiAodGV4dEJlZm9yZS5tYXRjaChcIlxcXFxkLz8kXCIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleEVuZCA8IGNvbnRleHQudGV4dC5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHRBZnRlciA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcoaW5kZXhFbmQpO1xuICAgICAgICAgICAgaWYgKHRleHRBZnRlci5tYXRjaChcIl4vP1xcXFxkXCIpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRleHQgPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKGluZGV4LCBpbmRleEVuZCk7XG4gICAgICAgIGlmICh0ZXh0Lm1hdGNoKC9eXFxkXFwuXFxkJC8pIHx8IHRleHQubWF0Y2goL15cXGRcXC5cXGR7MSwyfVxcLlxcZHsxLDJ9XFxzKiQvKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghbWF0Y2hbWUVBUl9HUk9VUF0gJiYgdGV4dC5pbmRleE9mKFwiL1wiKSA8IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQoaW5kZXgsIHRleHQpO1xuICAgICAgICBsZXQgbW9udGggPSBwYXJzZUludChtYXRjaFt0aGlzLmdyb3VwTnVtYmVyTW9udGhdKTtcbiAgICAgICAgbGV0IGRheSA9IHBhcnNlSW50KG1hdGNoW3RoaXMuZ3JvdXBOdW1iZXJEYXldKTtcbiAgICAgICAgaWYgKG1vbnRoIDwgMSB8fCBtb250aCA+IDEyKSB7XG4gICAgICAgICAgICBpZiAobW9udGggPiAxMikge1xuICAgICAgICAgICAgICAgIGlmIChkYXkgPj0gMSAmJiBkYXkgPD0gMTIgJiYgbW9udGggPD0gMzEpIHtcbiAgICAgICAgICAgICAgICAgICAgW2RheSwgbW9udGhdID0gW21vbnRoLCBkYXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkYXkgPCAxIHx8IGRheSA+IDMxKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIGRheSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBtb250aCk7XG4gICAgICAgIGlmIChtYXRjaFtZRUFSX0dST1VQXSkge1xuICAgICAgICAgICAgY29uc3QgcmF3WWVhck51bWJlciA9IHBhcnNlSW50KG1hdGNoW1lFQVJfR1JPVVBdKTtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBmaW5kTW9zdExpa2VseUFEWWVhcihyYXdZZWFyTnVtYmVyKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IGZpbmRZZWFyQ2xvc2VzdFRvUmVmKGNvbnRleHQucmVmRGF0ZSwgZGF5LCBtb250aCk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQuYWRkVGFnKFwicGFyc2VyL1NsYXNoRGF0ZUZvcm1hdFBhcnNlclwiKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1TbGFzaERhdGVGb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgVElNRV9VTklUU19QQVRURVJOLCBwYXJzZUR1cmF0aW9uLCBUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuaW1wb3J0IHsgcmV2ZXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKHRoaXN8bGFzdHxwYXN0fG5leHR8YWZ0ZXJ8XFxcXCt8LSlcXFxccyooJHtUSU1FX1VOSVRTX1BBVFRFUk59KSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgUEFUVEVSTl9OT19BQkJSID0gbmV3IFJlZ0V4cChgKHRoaXN8bGFzdHxwYXN0fG5leHR8YWZ0ZXJ8XFxcXCt8LSlcXFxccyooJHtUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTn0pKD89XFxcXFd8JClgLCBcImlcIik7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlRpbWVVbml0Q2FzdWFsUmVsYXRpdmVGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgYWxsb3dBYmJyZXZpYXRpb25zO1xuICAgIGNvbnN0cnVjdG9yKGFsbG93QWJicmV2aWF0aW9ucyA9IHRydWUpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5hbGxvd0FiYnJldmlhdGlvbnMgPSBhbGxvd0FiYnJldmlhdGlvbnM7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYWxsb3dBYmJyZXZpYXRpb25zID8gUEFUVEVSTiA6IFBBVFRFUk5fTk9fQUJCUjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHByZWZpeCA9IG1hdGNoWzFdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGxldCBkdXJhdGlvbiA9IHBhcnNlRHVyYXRpb24obWF0Y2hbMl0pO1xuICAgICAgICBpZiAoIWR1cmF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBzd2l0Y2ggKHByZWZpeCkge1xuICAgICAgICAgICAgY2FzZSBcImxhc3RcIjpcbiAgICAgICAgICAgIGNhc2UgXCJwYXN0XCI6XG4gICAgICAgICAgICBjYXNlIFwiLVwiOlxuICAgICAgICAgICAgICAgIGR1cmF0aW9uID0gcmV2ZXJzZUR1cmF0aW9uKGR1cmF0aW9uKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCBkdXJhdGlvbik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5UaW1lVW5pdENhc3VhbFJlbGF0aXZlRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cywgUGFyc2luZ1Jlc3VsdCwgUmVmZXJlbmNlV2l0aFRpbWV6b25lIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IHBhcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyByZXZlcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vLi4vLi4vY2FsY3VsYXRpb24vZHVyYXRpb24uanNcIjtcbmZ1bmN0aW9uIElzUG9zaXRpdmVGb2xsb3dpbmdSZWZlcmVuY2UocmVzdWx0KSB7XG4gICAgcmV0dXJuIHJlc3VsdC50ZXh0Lm1hdGNoKC9eWystXS9pKSAhPSBudWxsO1xufVxuZnVuY3Rpb24gSXNOZWdhdGl2ZUZvbGxvd2luZ1JlZmVyZW5jZShyZXN1bHQpIHtcbiAgICByZXR1cm4gcmVzdWx0LnRleHQubWF0Y2goL14tL2kpICE9IG51bGw7XG59XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyIGV4dGVuZHMgTWVyZ2luZ1JlZmluZXIge1xuICAgIHNob3VsZE1lcmdlUmVzdWx0cyh0ZXh0QmV0d2VlbiwgY3VycmVudFJlc3VsdCwgbmV4dFJlc3VsdCkge1xuICAgICAgICBpZiAoIXRleHRCZXR3ZWVuLm1hdGNoKC9eXFxzKiQvaSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSXNQb3NpdGl2ZUZvbGxvd2luZ1JlZmVyZW5jZShuZXh0UmVzdWx0KSB8fCBJc05lZ2F0aXZlRm9sbG93aW5nUmVmZXJlbmNlKG5leHRSZXN1bHQpO1xuICAgIH1cbiAgICBtZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQsIGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHRpbWVVbml0cyA9IHBhcnNlRHVyYXRpb24obmV4dFJlc3VsdC50ZXh0KTtcbiAgICAgICAgaWYgKElzTmVnYXRpdmVGb2xsb3dpbmdSZWZlcmVuY2UobmV4dFJlc3VsdCkpIHtcbiAgICAgICAgICAgIHRpbWVVbml0cyA9IHJldmVyc2VEdXJhdGlvbih0aW1lVW5pdHMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoUmVmZXJlbmNlV2l0aFRpbWV6b25lLmZyb21EYXRlKGN1cnJlbnRSZXN1bHQuc3RhcnQuZGF0ZSgpKSwgdGltZVVuaXRzKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQYXJzaW5nUmVzdWx0KGN1cnJlbnRSZXN1bHQucmVmZXJlbmNlLCBjdXJyZW50UmVzdWx0LmluZGV4LCBgJHtjdXJyZW50UmVzdWx0LnRleHR9JHt0ZXh0QmV0d2Vlbn0ke25leHRSZXN1bHQudGV4dH1gLCBjb21wb25lbnRzKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IE1lcmdpbmdSZWZpbmVyIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cywgUGFyc2luZ1Jlc3VsdCwgUmVmZXJlbmNlV2l0aFRpbWV6b25lIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IHBhcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyByZXZlcnNlRHVyYXRpb24gfSBmcm9tIFwiLi4vLi4vLi4vY2FsY3VsYXRpb24vZHVyYXRpb24uanNcIjtcbmZ1bmN0aW9uIGhhc0ltcGxpZWRFYXJsaWVyUmVmZXJlbmNlRGF0ZShyZXN1bHQpIHtcbiAgICByZXR1cm4gcmVzdWx0LnRleHQubWF0Y2goL1xccysoYmVmb3JlfGZyb20pJC9pKSAhPSBudWxsO1xufVxuZnVuY3Rpb24gaGFzSW1wbGllZExhdGVyUmVmZXJlbmNlRGF0ZShyZXN1bHQpIHtcbiAgICByZXR1cm4gcmVzdWx0LnRleHQubWF0Y2goL1xccysoYWZ0ZXJ8c2luY2UpJC9pKSAhPSBudWxsO1xufVxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5NZXJnZVJlbGF0aXZlRm9sbG93QnlEYXRlUmVmaW5lciBleHRlbmRzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICBwYXR0ZXJuQmV0d2VlbigpIHtcbiAgICAgICAgcmV0dXJuIC9eXFxzKiQvaTtcbiAgICB9XG4gICAgc2hvdWxkTWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIGlmICghdGV4dEJldHdlZW4ubWF0Y2godGhpcy5wYXR0ZXJuQmV0d2VlbigpKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaGFzSW1wbGllZEVhcmxpZXJSZWZlcmVuY2VEYXRlKGN1cnJlbnRSZXN1bHQpICYmICFoYXNJbXBsaWVkTGF0ZXJSZWZlcmVuY2VEYXRlKGN1cnJlbnRSZXN1bHQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICEhbmV4dFJlc3VsdC5zdGFydC5nZXQoXCJkYXlcIikgJiYgISFuZXh0UmVzdWx0LnN0YXJ0LmdldChcIm1vbnRoXCIpICYmICEhbmV4dFJlc3VsdC5zdGFydC5nZXQoXCJ5ZWFyXCIpO1xuICAgIH1cbiAgICBtZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgbGV0IGR1cmF0aW9uID0gcGFyc2VEdXJhdGlvbihjdXJyZW50UmVzdWx0LnRleHQpO1xuICAgICAgICBpZiAoaGFzSW1wbGllZEVhcmxpZXJSZWZlcmVuY2VEYXRlKGN1cnJlbnRSZXN1bHQpKSB7XG4gICAgICAgICAgICBkdXJhdGlvbiA9IHJldmVyc2VEdXJhdGlvbihkdXJhdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IFBhcnNpbmdDb21wb25lbnRzLmNyZWF0ZVJlbGF0aXZlRnJvbVJlZmVyZW5jZShSZWZlcmVuY2VXaXRoVGltZXpvbmUuZnJvbURhdGUobmV4dFJlc3VsdC5zdGFydC5kYXRlKCkpLCBkdXJhdGlvbik7XG4gICAgICAgIHJldHVybiBuZXcgUGFyc2luZ1Jlc3VsdChuZXh0UmVzdWx0LnJlZmVyZW5jZSwgY3VycmVudFJlc3VsdC5pbmRleCwgYCR7Y3VycmVudFJlc3VsdC50ZXh0fSR7dGV4dEJldHdlZW59JHtuZXh0UmVzdWx0LnRleHR9YCwgY29tcG9uZW50cyk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5NZXJnZVJlbGF0aXZlRm9sbG93QnlEYXRlUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgeyBZRUFSX1BBVFRFUk4sIHBhcnNlWWVhciB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmNvbnN0IFlFQVJfU1VGRklYX1BBVFRFUk4gPSBuZXcgUmVnRXhwKGBeXFxcXHMqKCR7WUVBUl9QQVRURVJOfSlgLCBcImlcIik7XG5jb25zdCBZRUFSX0dST1VQID0gMTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVORXh0cmFjdFllYXJTdWZmaXhSZWZpbmVyIHtcbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICByZXN1bHRzLmZvckVhY2goZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQuc3RhcnQuaXNEYXRlV2l0aFVua25vd25ZZWFyKCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzdWZmaXggPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKHJlc3VsdC5pbmRleCArIHJlc3VsdC50ZXh0Lmxlbmd0aCk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IFlFQVJfU1VGRklYX1BBVFRFUk4uZXhlYyhzdWZmaXgpO1xuICAgICAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtYXRjaFswXS50cmltKCkubGVuZ3RoIDw9IDMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXh0cmFjdGluZyB5ZWFyOiAnJHttYXRjaFswXX0nIGludG8gOiAke3Jlc3VsdH1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IHBhcnNlWWVhcihtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgeWVhcik7XG4gICAgICAgICAgICByZXN1bHQudGV4dCArPSBtYXRjaFswXTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVORXh0cmFjdFllYXJTdWZmaXhSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IEZpbHRlciB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vYWJzdHJhY3RSZWZpbmVycy5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5Vbmxpa2VseUZvcm1hdEZpbHRlciBleHRlbmRzIEZpbHRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgfVxuICAgIGlzVmFsaWQoY29udGV4dCwgcmVzdWx0KSB7XG4gICAgICAgIGNvbnN0IHRleHQgPSByZXN1bHQudGV4dC50cmltKCk7XG4gICAgICAgIGlmICh0ZXh0ID09PSBjb250ZXh0LnRleHQudHJpbSgpKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGV4dC50b0xvd2VyQ2FzZSgpID09PSBcIm1heVwiKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0QmVmb3JlID0gY29udGV4dC50ZXh0LnN1YnN0cmluZygwLCByZXN1bHQuaW5kZXgpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICghdGV4dEJlZm9yZS5tYXRjaCgvXFxiKGluKSQvaSkpIHtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFJlbW92aW5nIHVubGlrZWx5IHJlc3VsdDogJHtyZXN1bHR9YCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0ZXh0LnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoXCJ0aGUgc2Vjb25kXCIpKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0QWZ0ZXIgPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKHJlc3VsdC5pbmRleCArIHJlc3VsdC50ZXh0Lmxlbmd0aCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKHRleHRBZnRlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSZW1vdmluZyB1bmxpa2VseSByZXN1bHQ6ICR7cmVzdWx0fWApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVW5saWtlbHlGb3JtYXRGaWx0ZXIuanMubWFwIiwiaW1wb3J0IEVOVGltZVVuaXRXaXRoaW5Gb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVVbml0V2l0aGluRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5Nb250aE5hbWVMaXR0bGVFbmRpYW5QYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTk1vbnRoTmFtZUxpdHRsZUVuZGlhblBhcnNlci5qc1wiO1xuaW1wb3J0IEVOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5Nb250aE5hbWVNaWRkbGVFbmRpYW5QYXJzZXIuanNcIjtcbmltcG9ydCBFTk1vbnRoTmFtZVBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOTW9udGhOYW1lUGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5ZZWFyTW9udGhEYXlQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlllYXJNb250aERheVBhcnNlci5qc1wiO1xuaW1wb3J0IEVOU2xhc2hNb250aEZvcm1hdFBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOU2xhc2hNb250aEZvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IEVOVGltZUV4cHJlc3Npb25QYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVFeHByZXNzaW9uUGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5UaW1lVW5pdEFnb0Zvcm1hdFBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTk1lcmdlRGF0ZVJhbmdlUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9FTk1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qc1wiO1xuaW1wb3J0IEVOTWVyZ2VEYXRlVGltZVJlZmluZXIgZnJvbSBcIi4vcmVmaW5lcnMvRU5NZXJnZURhdGVUaW1lUmVmaW5lci5qc1wiO1xuaW1wb3J0IHsgaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24gfSBmcm9tIFwiLi4vLi4vY29uZmlndXJhdGlvbnMuanNcIjtcbmltcG9ydCBFTkNhc3VhbERhdGVQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTkNhc3VhbERhdGVQYXJzZXIuanNcIjtcbmltcG9ydCBFTkNhc3VhbFRpbWVQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTkNhc3VhbFRpbWVQYXJzZXIuanNcIjtcbmltcG9ydCBFTldlZWtkYXlQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTldlZWtkYXlQYXJzZXIuanNcIjtcbmltcG9ydCBFTlJlbGF0aXZlRGF0ZUZvcm1hdFBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOUmVsYXRpdmVEYXRlRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgU2xhc2hEYXRlRm9ybWF0UGFyc2VyIGZyb20gXCIuLi8uLi9jb21tb24vcGFyc2Vycy9TbGFzaERhdGVGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTlRpbWVVbml0Q2FzdWFsUmVsYXRpdmVGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVVbml0Q2FzdWFsUmVsYXRpdmVGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyIGZyb20gXCIuL3JlZmluZXJzL0VOTWVyZ2VSZWxhdGl2ZUFmdGVyRGF0ZVJlZmluZXIuanNcIjtcbmltcG9ydCBFTk1lcmdlUmVsYXRpdmVGb2xsb3dCeURhdGVSZWZpbmVyIGZyb20gXCIuL3JlZmluZXJzL0VOTWVyZ2VSZWxhdGl2ZUZvbGxvd0J5RGF0ZVJlZmluZXIuanNcIjtcbmltcG9ydCBPdmVybGFwUmVtb3ZhbFJlZmluZXIgZnJvbSBcIi4uLy4uL2NvbW1vbi9yZWZpbmVycy9PdmVybGFwUmVtb3ZhbFJlZmluZXIuanNcIjtcbmltcG9ydCBFTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9FTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lci5qc1wiO1xuaW1wb3J0IEVOVW5saWtlbHlGb3JtYXRGaWx0ZXIgZnJvbSBcIi4vcmVmaW5lcnMvRU5Vbmxpa2VseUZvcm1hdEZpbHRlci5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5EZWZhdWx0Q29uZmlndXJhdGlvbiB7XG4gICAgY3JlYXRlQ2FzdWFsQ29uZmlndXJhdGlvbihsaXR0bGVFbmRpYW4gPSBmYWxzZSkge1xuICAgICAgICBjb25zdCBvcHRpb24gPSB0aGlzLmNyZWF0ZUNvbmZpZ3VyYXRpb24oZmFsc2UsIGxpdHRsZUVuZGlhbik7XG4gICAgICAgIG9wdGlvbi5wYXJzZXJzLnB1c2gobmV3IEVOQ2FzdWFsRGF0ZVBhcnNlcigpKTtcbiAgICAgICAgb3B0aW9uLnBhcnNlcnMucHVzaChuZXcgRU5DYXN1YWxUaW1lUGFyc2VyKCkpO1xuICAgICAgICBvcHRpb24ucGFyc2Vycy5wdXNoKG5ldyBFTk1vbnRoTmFtZVBhcnNlcigpKTtcbiAgICAgICAgb3B0aW9uLnBhcnNlcnMucHVzaChuZXcgRU5SZWxhdGl2ZURhdGVGb3JtYXRQYXJzZXIoKSk7XG4gICAgICAgIG9wdGlvbi5wYXJzZXJzLnB1c2gobmV3IEVOVGltZVVuaXRDYXN1YWxSZWxhdGl2ZUZvcm1hdFBhcnNlcigpKTtcbiAgICAgICAgb3B0aW9uLnJlZmluZXJzLnB1c2gobmV3IEVOVW5saWtlbHlGb3JtYXRGaWx0ZXIoKSk7XG4gICAgICAgIHJldHVybiBvcHRpb247XG4gICAgfVxuICAgIGNyZWF0ZUNvbmZpZ3VyYXRpb24oc3RyaWN0TW9kZSA9IHRydWUsIGxpdHRsZUVuZGlhbiA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBpbmNsdWRlQ29tbW9uQ29uZmlndXJhdGlvbih7XG4gICAgICAgICAgICBwYXJzZXJzOiBbXG4gICAgICAgICAgICAgICAgbmV3IFNsYXNoRGF0ZUZvcm1hdFBhcnNlcihsaXR0bGVFbmRpYW4pLFxuICAgICAgICAgICAgICAgIG5ldyBFTlRpbWVVbml0V2l0aGluRm9ybWF0UGFyc2VyKHN0cmljdE1vZGUpLFxuICAgICAgICAgICAgICAgIG5ldyBFTk1vbnRoTmFtZUxpdHRsZUVuZGlhblBhcnNlcigpLFxuICAgICAgICAgICAgICAgIG5ldyBFTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlcihsaXR0bGVFbmRpYW4pLFxuICAgICAgICAgICAgICAgIG5ldyBFTldlZWtkYXlQYXJzZXIoKSxcbiAgICAgICAgICAgICAgICBuZXcgRU5TbGFzaE1vbnRoRm9ybWF0UGFyc2VyKCksXG4gICAgICAgICAgICAgICAgbmV3IEVOVGltZUV4cHJlc3Npb25QYXJzZXIoc3RyaWN0TW9kZSksXG4gICAgICAgICAgICAgICAgbmV3IEVOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIoc3RyaWN0TW9kZSksXG4gICAgICAgICAgICAgICAgbmV3IEVOVGltZVVuaXRMYXRlckZvcm1hdFBhcnNlcihzdHJpY3RNb2RlKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICByZWZpbmVyczogW25ldyBFTk1lcmdlRGF0ZVRpbWVSZWZpbmVyKCldLFxuICAgICAgICB9LCBzdHJpY3RNb2RlKTtcbiAgICAgICAgb3B0aW9ucy5wYXJzZXJzLnVuc2hpZnQobmV3IEVOWWVhck1vbnRoRGF5UGFyc2VyKHN0cmljdE1vZGUpKTtcbiAgICAgICAgb3B0aW9ucy5yZWZpbmVycy51bnNoaWZ0KG5ldyBFTk1lcmdlUmVsYXRpdmVGb2xsb3dCeURhdGVSZWZpbmVyKCkpO1xuICAgICAgICBvcHRpb25zLnJlZmluZXJzLnVuc2hpZnQobmV3IEVOTWVyZ2VSZWxhdGl2ZUFmdGVyRGF0ZVJlZmluZXIoKSk7XG4gICAgICAgIG9wdGlvbnMucmVmaW5lcnMudW5zaGlmdChuZXcgT3ZlcmxhcFJlbW92YWxSZWZpbmVyKCkpO1xuICAgICAgICBvcHRpb25zLnJlZmluZXJzLnB1c2gobmV3IEVOTWVyZ2VEYXRlVGltZVJlZmluZXIoKSk7XG4gICAgICAgIG9wdGlvbnMucmVmaW5lcnMucHVzaChuZXcgRU5FeHRyYWN0WWVhclN1ZmZpeFJlZmluZXIoKSk7XG4gICAgICAgIG9wdGlvbnMucmVmaW5lcnMucHVzaChuZXcgRU5NZXJnZURhdGVSYW5nZVJlZmluZXIoKSk7XG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNvbmZpZ3VyYXRpb24uanMubWFwIiwiaW1wb3J0IHsgUmVmZXJlbmNlV2l0aFRpbWV6b25lLCBQYXJzaW5nQ29tcG9uZW50cywgUGFyc2luZ1Jlc3VsdCB9IGZyb20gXCIuL3Jlc3VsdHMuanNcIjtcbmltcG9ydCBFTkRlZmF1bHRDb25maWd1cmF0aW9uIGZyb20gXCIuL2xvY2FsZXMvZW4vY29uZmlndXJhdGlvbi5qc1wiO1xuZXhwb3J0IGNsYXNzIENocm9ubyB7XG4gICAgcGFyc2VycztcbiAgICByZWZpbmVycztcbiAgICBkZWZhdWx0Q29uZmlnID0gbmV3IEVORGVmYXVsdENvbmZpZ3VyYXRpb24oKTtcbiAgICBjb25zdHJ1Y3Rvcihjb25maWd1cmF0aW9uKSB7XG4gICAgICAgIGNvbmZpZ3VyYXRpb24gPSBjb25maWd1cmF0aW9uIHx8IHRoaXMuZGVmYXVsdENvbmZpZy5jcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCk7XG4gICAgICAgIHRoaXMucGFyc2VycyA9IFsuLi5jb25maWd1cmF0aW9uLnBhcnNlcnNdO1xuICAgICAgICB0aGlzLnJlZmluZXJzID0gWy4uLmNvbmZpZ3VyYXRpb24ucmVmaW5lcnNdO1xuICAgIH1cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBDaHJvbm8oe1xuICAgICAgICAgICAgcGFyc2VyczogWy4uLnRoaXMucGFyc2Vyc10sXG4gICAgICAgICAgICByZWZpbmVyczogWy4uLnRoaXMucmVmaW5lcnNdLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcGFyc2VEYXRlKHRleHQsIHJlZmVyZW5jZURhdGUsIG9wdGlvbikge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gdGhpcy5wYXJzZSh0ZXh0LCByZWZlcmVuY2VEYXRlLCBvcHRpb24pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cy5sZW5ndGggPiAwID8gcmVzdWx0c1swXS5zdGFydC5kYXRlKCkgOiBudWxsO1xuICAgIH1cbiAgICBwYXJzZSh0ZXh0LCByZWZlcmVuY2VEYXRlLCBvcHRpb24pIHtcbiAgICAgICAgY29uc3QgY29udGV4dCA9IG5ldyBQYXJzaW5nQ29udGV4dCh0ZXh0LCByZWZlcmVuY2VEYXRlLCBvcHRpb24pO1xuICAgICAgICBsZXQgcmVzdWx0cyA9IFtdO1xuICAgICAgICB0aGlzLnBhcnNlcnMuZm9yRWFjaCgocGFyc2VyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWRSZXN1bHRzID0gQ2hyb25vLmV4ZWN1dGVQYXJzZXIoY29udGV4dCwgcGFyc2VyKTtcbiAgICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmNvbmNhdChwYXJzZWRSZXN1bHRzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlc3VsdHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGEuaW5kZXggLSBiLmluZGV4O1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5yZWZpbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChyZWZpbmVyKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVmaW5lci5yZWZpbmUoY29udGV4dCwgcmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG4gICAgc3RhdGljIGV4ZWN1dGVQYXJzZXIoY29udGV4dCwgcGFyc2VyKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgY29uc3QgcGF0dGVybiA9IHBhcnNlci5wYXR0ZXJuKGNvbnRleHQpO1xuICAgICAgICBjb25zdCBvcmlnaW5hbFRleHQgPSBjb250ZXh0LnRleHQ7XG4gICAgICAgIGxldCByZW1haW5pbmdUZXh0ID0gY29udGV4dC50ZXh0O1xuICAgICAgICBsZXQgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgICAgIHdoaWxlIChtYXRjaCkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBtYXRjaC5pbmRleCArIG9yaWdpbmFsVGV4dC5sZW5ndGggLSByZW1haW5pbmdUZXh0Lmxlbmd0aDtcbiAgICAgICAgICAgIG1hdGNoLmluZGV4ID0gaW5kZXg7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBwYXJzZXIuZXh0cmFjdChjb250ZXh0LCBtYXRjaCk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJlbWFpbmluZ1RleHQgPSBvcmlnaW5hbFRleHQuc3Vic3RyaW5nKG1hdGNoLmluZGV4ICsgMSk7XG4gICAgICAgICAgICAgICAgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcGFyc2VkUmVzdWx0ID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgaW5zdGFuY2VvZiBQYXJzaW5nUmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgcGFyc2VkUmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAocmVzdWx0IGluc3RhbmNlb2YgUGFyc2luZ0NvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICBwYXJzZWRSZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgICAgICAgICBwYXJzZWRSZXN1bHQuc3RhcnQgPSByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBwYXJzZWRSZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdLCByZXN1bHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcGFyc2VkSW5kZXggPSBwYXJzZWRSZXN1bHQuaW5kZXg7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWRUZXh0ID0gcGFyc2VkUmVzdWx0LnRleHQ7XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IGNvbnNvbGUubG9nKGAke3BhcnNlci5jb25zdHJ1Y3Rvci5uYW1lfSBleHRyYWN0ZWQgKGF0IGluZGV4PSR7cGFyc2VkSW5kZXh9KSAnJHtwYXJzZWRUZXh0fSdgKSk7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2gocGFyc2VkUmVzdWx0KTtcbiAgICAgICAgICAgIHJlbWFpbmluZ1RleHQgPSBvcmlnaW5hbFRleHQuc3Vic3RyaW5nKHBhcnNlZEluZGV4ICsgcGFyc2VkVGV4dC5sZW5ndGgpO1xuICAgICAgICAgICAgbWF0Y2ggPSBwYXR0ZXJuLmV4ZWMocmVtYWluaW5nVGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFBhcnNpbmdDb250ZXh0IHtcbiAgICB0ZXh0O1xuICAgIG9wdGlvbjtcbiAgICByZWZlcmVuY2U7XG4gICAgcmVmRGF0ZTtcbiAgICBjb25zdHJ1Y3Rvcih0ZXh0LCByZWZEYXRlLCBvcHRpb24pIHtcbiAgICAgICAgdGhpcy50ZXh0ID0gdGV4dDtcbiAgICAgICAgdGhpcy5vcHRpb24gPSBvcHRpb24gPz8ge307XG4gICAgICAgIHRoaXMucmVmZXJlbmNlID0gUmVmZXJlbmNlV2l0aFRpbWV6b25lLmZyb21JbnB1dChyZWZEYXRlLCB0aGlzLm9wdGlvbi50aW1lem9uZXMpO1xuICAgICAgICB0aGlzLnJlZkRhdGUgPSB0aGlzLnJlZmVyZW5jZS5pbnN0YW50O1xuICAgIH1cbiAgICBjcmVhdGVQYXJzaW5nQ29tcG9uZW50cyhjb21wb25lbnRzKSB7XG4gICAgICAgIGlmIChjb21wb25lbnRzIGluc3RhbmNlb2YgUGFyc2luZ0NvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnRzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgUGFyc2luZ0NvbXBvbmVudHModGhpcy5yZWZlcmVuY2UsIGNvbXBvbmVudHMpO1xuICAgIH1cbiAgICBjcmVhdGVQYXJzaW5nUmVzdWx0KGluZGV4LCB0ZXh0T3JFbmRJbmRleCwgc3RhcnRDb21wb25lbnRzLCBlbmRDb21wb25lbnRzKSB7XG4gICAgICAgIGNvbnN0IHRleHQgPSB0eXBlb2YgdGV4dE9yRW5kSW5kZXggPT09IFwic3RyaW5nXCIgPyB0ZXh0T3JFbmRJbmRleCA6IHRoaXMudGV4dC5zdWJzdHJpbmcoaW5kZXgsIHRleHRPckVuZEluZGV4KTtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBzdGFydENvbXBvbmVudHMgPyB0aGlzLmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKHN0YXJ0Q29tcG9uZW50cykgOiBudWxsO1xuICAgICAgICBjb25zdCBlbmQgPSBlbmRDb21wb25lbnRzID8gdGhpcy5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cyhlbmRDb21wb25lbnRzKSA6IG51bGw7XG4gICAgICAgIHJldHVybiBuZXcgUGFyc2luZ1Jlc3VsdCh0aGlzLnJlZmVyZW5jZSwgaW5kZXgsIHRleHQsIHN0YXJ0LCBlbmQpO1xuICAgIH1cbiAgICBkZWJ1ZyhibG9jaykge1xuICAgICAgICBpZiAodGhpcy5vcHRpb24uZGVidWcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbi5kZWJ1ZyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vcHRpb24uZGVidWcoYmxvY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IHRoaXMub3B0aW9uLmRlYnVnO1xuICAgICAgICAgICAgICAgIGhhbmRsZXIuZGVidWcoYmxvY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2hyb25vLmpzLm1hcCIsImV4cG9ydCBjb25zdCBOVU1CRVIgPSB7XG4gICAgXCLpm7ZcIjogMCxcbiAgICBcIuOAh1wiOiAwLFxuICAgIFwi5LiAXCI6IDEsXG4gICAgXCLkuoxcIjogMixcbiAgICBcIuS4pFwiOiAyLFxuICAgIFwi5LiJXCI6IDMsXG4gICAgXCLlm5tcIjogNCxcbiAgICBcIuS6lFwiOiA1LFxuICAgIFwi5YWtXCI6IDYsXG4gICAgXCLkuINcIjogNyxcbiAgICBcIuWFq1wiOiA4LFxuICAgIFwi5LmdXCI6IDksXG4gICAgXCLljYFcIjogMTAsXG59O1xuZXhwb3J0IGNvbnN0IFdFRUtEQVlfT0ZGU0VUID0ge1xuICAgIFwi5aSpXCI6IDAsXG4gICAgXCLml6VcIjogMCxcbiAgICBcIuS4gFwiOiAxLFxuICAgIFwi5LqMXCI6IDIsXG4gICAgXCLkuIlcIjogMyxcbiAgICBcIuWbm1wiOiA0LFxuICAgIFwi5LqUXCI6IDUsXG4gICAgXCLlha1cIjogNixcbn07XG5leHBvcnQgZnVuY3Rpb24gemhTdHJpbmdUb051bWJlcih0ZXh0KSB7XG4gICAgbGV0IG51bWJlciA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSB0ZXh0W2ldO1xuICAgICAgICBpZiAoY2hhciA9PT0gXCLljYFcIikge1xuICAgICAgICAgICAgbnVtYmVyID0gbnVtYmVyID09PSAwID8gTlVNQkVSW2NoYXJdIDogbnVtYmVyICogTlVNQkVSW2NoYXJdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbnVtYmVyICs9IE5VTUJFUltjaGFyXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbnVtYmVyO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHpoU3RyaW5nVG9ZZWFyKHRleHQpIHtcbiAgICBsZXQgc3RyaW5nID0gXCJcIjtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY2hhciA9IHRleHRbaV07XG4gICAgICAgIHN0cmluZyA9IHN0cmluZyArIE5VTUJFUltjaGFyXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlSW50KHN0cmluZyk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb25zdGFudHMuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBOVU1CRVIsIHpoU3RyaW5nVG9OdW1iZXIsIHpoU3RyaW5nVG9ZZWFyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgWUVBUl9HUk9VUCA9IDE7XG5jb25zdCBNT05USF9HUk9VUCA9IDI7XG5jb25zdCBEQVlfR1JPVVAgPSAzO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zRGF0ZVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnRXhwKFwiKFwiICtcbiAgICAgICAgICAgIFwiXFxcXGR7Miw0fXxcIiArXG4gICAgICAgICAgICBcIltcIiArXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgICAgICAgICAgXCJdezR9fFwiICtcbiAgICAgICAgICAgIFwiW1wiICtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgICAgICAgICBcIl17Mn1cIiArXG4gICAgICAgICAgICBcIik/XCIgK1xuICAgICAgICAgICAgXCIoPzpcXFxccyopXCIgK1xuICAgICAgICAgICAgXCIoPzrlubQpP1wiICtcbiAgICAgICAgICAgIFwiKD86W1xcXFxzfCx877yMXSopXCIgK1xuICAgICAgICAgICAgXCIoXCIgK1xuICAgICAgICAgICAgXCJcXFxcZHsxLDJ9fFwiICtcbiAgICAgICAgICAgIFwiW1wiICtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgICAgICAgICBcIl17MSwzfVwiICtcbiAgICAgICAgICAgIFwiKVwiICtcbiAgICAgICAgICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICAgICAgICAgIFwiKD865pyIKVwiICtcbiAgICAgICAgICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICAgICAgICAgIFwiKFwiICtcbiAgICAgICAgICAgIFwiXFxcXGR7MSwyfXxcIiArXG4gICAgICAgICAgICBcIltcIiArXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgICAgICAgICAgXCJdezEsM31cIiArXG4gICAgICAgICAgICBcIik/XCIgK1xuICAgICAgICAgICAgXCIoPzpcXFxccyopXCIgK1xuICAgICAgICAgICAgXCIoPzrml6V85Y+3KT9cIik7XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgbGV0IG1vbnRoID0gcGFyc2VJbnQobWF0Y2hbTU9OVEhfR1JPVVBdKTtcbiAgICAgICAgaWYgKGlzTmFOKG1vbnRoKSlcbiAgICAgICAgICAgIG1vbnRoID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtNT05USF9HUk9VUF0pO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgbW9udGgpO1xuICAgICAgICBpZiAobWF0Y2hbREFZX0dST1VQXSkge1xuICAgICAgICAgICAgbGV0IGRheSA9IHBhcnNlSW50KG1hdGNoW0RBWV9HUk9VUF0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKGRheSkpXG4gICAgICAgICAgICAgICAgZGF5ID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtEQVlfR1JPVVBdKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgZGF5KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBjb250ZXh0LnJlZkRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGxldCB5ZWFyID0gcGFyc2VJbnQobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgaWYgKGlzTmFOKHllYXIpKVxuICAgICAgICAgICAgICAgIHllYXIgPSB6aFN0cmluZ1RvWWVhcihtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgY29udGV4dC5yZWZEYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9WkhIYW5zRGF0ZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IGFkZER1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5pbXBvcnQgeyBOVU1CRVIsIHpoU3RyaW5nVG9OdW1iZXIgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChcIihcXFxcZCt8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSt85Y2KfOWHoCkoPzpcXFxccyopXCIgK1xuICAgIFwiKD865LiqKT9cIiArXG4gICAgXCIo56eSKD866ZKfKT985YiG6ZKffOWwj+aXtnzpkp985pelfOWkqXzmmJ/mnJ9856S85oucfOaciHzlubQpXCIgK1xuICAgIFwiKD86KD865LmLfOi/hyk/5ZCOfCg/OuS5iyk/5YaFKVwiLCBcImlcIik7XG5jb25zdCBOVU1CRVJfR1JPVVAgPSAxO1xuY29uc3QgVU5JVF9HUk9VUCA9IDI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBaSEhhbnNEZWFkbGluZUZvcm1hdFBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGxldCBudW1iZXIgPSBwYXJzZUludChtYXRjaFtOVU1CRVJfR1JPVVBdKTtcbiAgICAgICAgaWYgKGlzTmFOKG51bWJlcikpIHtcbiAgICAgICAgICAgIG51bWJlciA9IHpoU3RyaW5nVG9OdW1iZXIobWF0Y2hbTlVNQkVSX0dST1VQXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzTmFOKG51bWJlcikpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0cmluZyA9IG1hdGNoW05VTUJFUl9HUk9VUF07XG4gICAgICAgICAgICBpZiAoc3RyaW5nID09PSBcIuWHoFwiKSB7XG4gICAgICAgICAgICAgICAgbnVtYmVyID0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHN0cmluZyA9PT0gXCLljYpcIikge1xuICAgICAgICAgICAgICAgIG51bWJlciA9IDAuNTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGR1cmF0aW9uID0ge307XG4gICAgICAgIGNvbnN0IHVuaXQgPSBtYXRjaFtVTklUX0dST1VQXTtcbiAgICAgICAgY29uc3QgdW5pdEFiYnIgPSB1bml0WzBdO1xuICAgICAgICBpZiAodW5pdEFiYnIubWF0Y2goL1vml6XlpKnmmJ/npLzmnIjlubRdLykpIHtcbiAgICAgICAgICAgIGlmICh1bml0QWJiciA9PSBcIuaXpVwiIHx8IHVuaXRBYmJyID09IFwi5aSpXCIpIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbi5kYXkgPSBudW1iZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh1bml0QWJiciA9PSBcIuaYn1wiIHx8IHVuaXRBYmJyID09IFwi56S8XCIpIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbi53ZWVrID0gbnVtYmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodW5pdEFiYnIgPT0gXCLmnIhcIikge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uLm1vbnRoID0gbnVtYmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodW5pdEFiYnIgPT0gXCLlubRcIikge1xuICAgICAgICAgICAgICAgIGR1cmF0aW9uLnllYXIgPSBudW1iZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBkYXRlID0gYWRkRHVyYXRpb24oY29udGV4dC5yZWZEYXRlLCBkdXJhdGlvbik7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIGlmICh1bml0QWJiciA9PSBcIuenklwiKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi5zZWNvbmQgPSBudW1iZXI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodW5pdEFiYnIgPT0gXCLliIZcIikge1xuICAgICAgICAgICAgZHVyYXRpb24ubWludXRlID0gbnVtYmVyO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaXRBYmJyID09IFwi5bCPXCIgfHwgdW5pdEFiYnIgPT0gXCLpkp9cIikge1xuICAgICAgICAgICAgZHVyYXRpb24uaG91ciA9IG51bWJlcjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkYXRlID0gYWRkRHVyYXRpb24oY29udGV4dC5yZWZEYXRlLCBkdXJhdGlvbik7XG4gICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJob3VyXCIsIGRhdGUuZ2V0SG91cnMoKSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtaW51dGVcIiwgZGF0ZS5nZXRNaW51dGVzKCkpO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwic2Vjb25kXCIsIGRhdGUuZ2V0U2Vjb25kcygpKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNEZWFkbGluZUZvcm1hdFBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IFdFRUtEQVlfT0ZGU0VUIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzxwcmVmaXg+5LiKfOS4i3zov5kpKD865LiqKT8oPzrmmJ/mnJ9856S85oucfOWRqCkoPzx3ZWVrZGF5PlwiICsgT2JqZWN0LmtleXMoV0VFS0RBWV9PRkZTRVQpLmpvaW4oXCJ8XCIpICsgXCIpXCIpO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zUmVsYXRpb25XZWVrZGF5UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgY29uc3QgZGF5T2ZXZWVrID0gbWF0Y2guZ3JvdXBzLndlZWtkYXk7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IFdFRUtEQVlfT0ZGU0VUW2RheU9mV2Vla107XG4gICAgICAgIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICBsZXQgbW9kaWZpZXIgPSBudWxsO1xuICAgICAgICBjb25zdCBwcmVmaXggPSBtYXRjaC5ncm91cHMucHJlZml4O1xuICAgICAgICBpZiAocHJlZml4ID09IFwi5LiKXCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJsYXN0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocHJlZml4ID09IFwi5LiLXCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJuZXh0XCI7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAocHJlZml4ID09IFwi6L+ZXCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJ0aGlzXCI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGNvbnRleHQucmVmRGF0ZS5nZXRUaW1lKCkpO1xuICAgICAgICBsZXQgc3RhcnRNb21lbnRGaXhlZCA9IGZhbHNlO1xuICAgICAgICBjb25zdCByZWZPZmZzZXQgPSBkYXRlLmdldERheSgpO1xuICAgICAgICBpZiAobW9kaWZpZXIgPT0gXCJsYXN0XCIgfHwgbW9kaWZpZXIgPT0gXCJwYXN0XCIpIHtcbiAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIChvZmZzZXQgLSA3IC0gcmVmT2Zmc2V0KSk7XG4gICAgICAgICAgICBzdGFydE1vbWVudEZpeGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtb2RpZmllciA9PSBcIm5leHRcIikge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgKG9mZnNldCArIDcgLSByZWZPZmZzZXQpKTtcbiAgICAgICAgICAgIHN0YXJ0TW9tZW50Rml4ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1vZGlmaWVyID09IFwidGhpc1wiKSB7XG4gICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyAob2Zmc2V0IC0gcmVmT2Zmc2V0KSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBsZXQgZGlmZiA9IG9mZnNldCAtIHJlZk9mZnNldDtcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhkaWZmIC0gNykgPCBNYXRoLmFicyhkaWZmKSkge1xuICAgICAgICAgICAgICAgIGRpZmYgLT0gNztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhkaWZmICsgNykgPCBNYXRoLmFicyhkaWZmKSkge1xuICAgICAgICAgICAgICAgIGRpZmYgKz0gNztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIGRpZmYpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ3ZWVrZGF5XCIsIG9mZnNldCk7XG4gICAgICAgIGlmIChzdGFydE1vbWVudEZpeGVkKSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNSZWxhdGlvbldlZWtkYXlQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBOVU1CRVIsIHpoU3RyaW5nVG9OdW1iZXIgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5jb25zdCBGSVJTVF9SRUdfUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzrku4586IeqKT9cIiArXG4gICAgXCIoPzpcIiArXG4gICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSjml6l85pydfOaZmil8XCIgK1xuICAgIFwiKOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKXxcIiArXG4gICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSg/OuaXpXzlpKkpXCIgK1xuICAgIFwiKD86W1xcXFxzLO+8jF0qKVwiICtcbiAgICBcIig/OijkuIooPzrljYgpfOaXqSg/OuS4iil85LiLKD865Y2IKXzmmZooPzrkuIopfOWknCg/OuaZmik/fOS4rSg/OuWNiCl85YeMKD865pmoKSkpP1wiICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD86W1xcXFxzLO+8jF0qKVwiICtcbiAgICBcIig/OihcXFxcZCt8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspKD86XFxcXHMqKSg/OueCuXzml7Z8OnzvvJopXCIgK1xuICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICBcIihcXFxcZCt85Y2KfOato3zmlbR8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspPyg/OlxcXFxzKikoPzrliIZ8OnzvvJopP1wiICtcbiAgICBcIig/OlxcXFxzKilcIiArXG4gICAgXCIoXFxcXGQrfFtcIiArXG4gICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICBcIl0rKT8oPzpcXFxccyopKD8656eSKT8pXCIgK1xuICAgIFwiKD86XFxcXHMqKEEuTS58UC5NLnxBTT98UE0/KSk/XCIsIFwiaVwiKTtcbmNvbnN0IFNFQ09ORF9SRUdfUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzpeXFxcXHMqKD865YiwfOiHs3xcXFxcLXxcXFxc4oCTfFxcXFx+fFxcXFzjgJwpXFxcXHMqKVwiICtcbiAgICBcIig/OlwiICtcbiAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKOaXqXzmnJ185pmaKXxcIiArXG4gICAgXCIo5LiKKD865Y2IKXzml6koPzrkuIopfOS4iyg/OuWNiCl85pmaKD865LiKKXzlpJwoPzrmmZopP3zkuK0oPzrljYgpfOWHjCg/OuaZqCkpfFwiICtcbiAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKD865pelfOWkqSlcIiArXG4gICAgXCIoPzpbXFxcXHMs77yMXSopXCIgK1xuICAgIFwiKD86KOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKSk/XCIgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPzpbXFxcXHMs77yMXSopXCIgK1xuICAgIFwiKD86KFxcXFxkK3xbXCIgK1xuICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgXCJdKykoPzpcXFxccyopKD8654K5fOaXtnw6fO+8milcIiArXG4gICAgXCIoPzpcXFxccyopXCIgK1xuICAgIFwiKFxcXFxkK3zljYp85q2jfOaVtHxbXCIgK1xuICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgXCJdKyk/KD86XFxcXHMqKSg/OuWIhnw6fO+8mik/XCIgK1xuICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICBcIihcXFxcZCt8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspPyg/OlxcXFxzKikoPzrnp5IpPylcIiArXG4gICAgXCIoPzpcXFxccyooQS5NLnxQLk0ufEFNP3xQTT8pKT9cIiwgXCJpXCIpO1xuY29uc3QgREFZX0dST1VQXzEgPSAxO1xuY29uc3QgWkhfQU1fUE1fSE9VUl9HUk9VUF8xID0gMjtcbmNvbnN0IFpIX0FNX1BNX0hPVVJfR1JPVVBfMiA9IDM7XG5jb25zdCBEQVlfR1JPVVBfMyA9IDQ7XG5jb25zdCBaSF9BTV9QTV9IT1VSX0dST1VQXzMgPSA1O1xuY29uc3QgSE9VUl9HUk9VUCA9IDY7XG5jb25zdCBNSU5VVEVfR1JPVVAgPSA3O1xuY29uc3QgU0VDT05EX0dST1VQID0gODtcbmNvbnN0IEFNX1BNX0hPVVJfR1JPVVAgPSA5O1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zVGltZUV4cHJlc3Npb25QYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgcGF0dGVybkxlZnRCb3VuZGFyeSgpIHtcbiAgICAgICAgcmV0dXJuIFwiKClcIjtcbiAgICB9XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gRklSU1RfUkVHX1BBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBpZiAobWF0Y2guaW5kZXggPiAwICYmIGNvbnRleHQudGV4dFttYXRjaC5pbmRleCAtIDFdLm1hdGNoKC9cXHcvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGNvbnN0IHN0YXJ0TW9tZW50ID0gbmV3IERhdGUoY29udGV4dC5yZWZlcmVuY2UuaW5zdGFudC5nZXRUaW1lKCkpO1xuICAgICAgICBpZiAobWF0Y2hbREFZX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkxID0gbWF0Y2hbREFZX0dST1VQXzFdO1xuICAgICAgICAgICAgaWYgKGRheTEgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGlmIChjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50LmdldEhvdXJzKCkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuaYqFwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgLSAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLliY1cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSAtIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWQjlwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgKyAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLlpKflkI5cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIHN0YXJ0TW9tZW50LmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgc3RhcnRNb21lbnQuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgc3RhcnRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbREFZX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkzID0gbWF0Y2hbREFZX0dST1VQXzNdO1xuICAgICAgICAgICAgaWYgKGRheTMgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5pioXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWJjVwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgLSAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKfliY1cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpIC0gMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSArIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWkp+WQjlwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgKyAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgc3RhcnRNb21lbnQuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBzdGFydE1vbWVudC5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCBzdGFydE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBzdGFydE1vbWVudC5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgc3RhcnRNb21lbnQuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCBzdGFydE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaG91ciA9IDA7XG4gICAgICAgIGxldCBtaW51dGUgPSAwO1xuICAgICAgICBsZXQgbWVyaWRpZW0gPSAtMTtcbiAgICAgICAgaWYgKG1hdGNoW1NFQ09ORF9HUk9VUF0pIHtcbiAgICAgICAgICAgIGxldCBzZWNvbmQgPSBwYXJzZUludChtYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChpc05hTihzZWNvbmQpKSB7XG4gICAgICAgICAgICAgICAgc2Vjb25kID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzZWNvbmQgPj0gNjApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwic2Vjb25kXCIsIHNlY29uZCk7XG4gICAgICAgIH1cbiAgICAgICAgaG91ciA9IHBhcnNlSW50KG1hdGNoW0hPVVJfR1JPVVBdKTtcbiAgICAgICAgaWYgKGlzTmFOKGhvdXIpKSB7XG4gICAgICAgICAgICBob3VyID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtIT1VSX0dST1VQXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW01JTlVURV9HUk9VUF0pIHtcbiAgICAgICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdID09IFwi5Y2KXCIpIHtcbiAgICAgICAgICAgICAgICBtaW51dGUgPSAzMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKG1hdGNoW01JTlVURV9HUk9VUF0gPT0gXCLmraNcIiB8fCBtYXRjaFtNSU5VVEVfR1JPVVBdID09IFwi5pW0XCIpIHtcbiAgICAgICAgICAgICAgICBtaW51dGUgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gcGFyc2VJbnQobWF0Y2hbTUlOVVRFX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgaWYgKGlzTmFOKG1pbnV0ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWludXRlID0gemhTdHJpbmdUb051bWJlcihtYXRjaFtNSU5VVEVfR1JPVVBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaG91ciA+IDEwMCkge1xuICAgICAgICAgICAgbWludXRlID0gaG91ciAlIDEwMDtcbiAgICAgICAgICAgIGhvdXIgPSBNYXRoLmZsb29yKGhvdXIgLyAxMDApO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtaW51dGUgPj0gNjApIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID4gMjQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID49IDEyKSB7XG4gICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdKSB7XG4gICAgICAgICAgICBpZiAoaG91ciA+IDEyKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3QgYW1wbSA9IG1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdWzBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBpZiAoYW1wbSA9PSBcImFcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYW1wbSA9PSBcInBcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCB6aEFNUE1TdHJpbmcxID0gbWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8xXTtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTTEgPSB6aEFNUE1TdHJpbmcxWzBdO1xuICAgICAgICAgICAgaWYgKHpoQU1QTTEgPT0gXCLml6lcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0xID09IFwi5pmaXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8yXSkge1xuICAgICAgICAgICAgY29uc3QgemhBTVBNU3RyaW5nMiA9IG1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMl07XG4gICAgICAgICAgICBjb25zdCB6aEFNUE0yID0gemhBTVBNU3RyaW5nMlswXTtcbiAgICAgICAgICAgIGlmICh6aEFNUE0yID09IFwi5LiKXCIgfHwgemhBTVBNMiA9PSBcIuaXqVwiIHx8IHpoQU1QTTIgPT0gXCLlh4xcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0yID09IFwi5LiLXCIgfHwgemhBTVBNMiA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTVN0cmluZzMgPSBtYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzNdO1xuICAgICAgICAgICAgY29uc3QgemhBTVBNMyA9IHpoQU1QTVN0cmluZzNbMF07XG4gICAgICAgICAgICBpZiAoemhBTVBNMyA9PSBcIuS4ilwiIHx8IHpoQU1QTTMgPT0gXCLml6lcIiB8fCB6aEFNUE0zID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMyA9PSBcIuS4i1wiIHx8IHpoQU1QTTMgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCBob3VyKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1pbnV0ZVwiLCBtaW51dGUpO1xuICAgICAgICBpZiAobWVyaWRpZW0gPj0gMCkge1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1lcmlkaWVtXCIsIG1lcmlkaWVtKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmIChob3VyIDwgMTIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNlY29uZE1hdGNoID0gU0VDT05EX1JFR19QQVRURVJOLmV4ZWMoY29udGV4dC50ZXh0LnN1YnN0cmluZyhyZXN1bHQuaW5kZXggKyByZXN1bHQudGV4dC5sZW5ndGgpKTtcbiAgICAgICAgaWYgKCFzZWNvbmRNYXRjaCkge1xuICAgICAgICAgICAgaWYgKHJlc3VsdC50ZXh0Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgZW5kTW9tZW50ID0gbmV3IERhdGUoc3RhcnRNb21lbnQuZ2V0VGltZSgpKTtcbiAgICAgICAgaWYgKHNlY29uZE1hdGNoW0RBWV9HUk9VUF8xXSB8fCBzZWNvbmRNYXRjaFtEQVlfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGVuZE1vbWVudCA9IG5ldyBEYXRlKGNvbnRleHQucmVmZXJlbmNlLmluc3RhbnQuZ2V0VGltZSgpKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuZW5kID0gY29udGV4dC5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cygpO1xuICAgICAgICBpZiAoc2Vjb25kTWF0Y2hbREFZX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkxID0gc2Vjb25kTWF0Y2hbREFZX0dST1VQXzFdO1xuICAgICAgICAgICAgaWYgKGRheTEgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGlmIChjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50LmdldEhvdXJzKCkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5pioXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImRheVwiLCBlbmRNb21lbnQuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwibW9udGhcIiwgZW5kTW9tZW50LmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwieWVhclwiLCBlbmRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2Vjb25kTWF0Y2hbREFZX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkzID0gc2Vjb25kTWF0Y2hbREFZX0dST1VQXzNdO1xuICAgICAgICAgICAgaWYgKGRheTMgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLmmKhcIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgLSAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLliY1cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgLSAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKfliY1cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgLSAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlkI5cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKflkI5cIikge1xuICAgICAgICAgICAgICAgIGVuZE1vbWVudC5zZXREYXRlKGVuZE1vbWVudC5nZXREYXRlKCkgKyAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwiZGF5XCIsIGVuZE1vbWVudC5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJtb250aFwiLCBlbmRNb21lbnQuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJ5ZWFyXCIsIGVuZE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuaW1wbHkoXCJkYXlcIiwgZW5kTW9tZW50LmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwibW9udGhcIiwgZW5kTW9tZW50LmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuaW1wbHkoXCJ5ZWFyXCIsIGVuZE1vbWVudC5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBob3VyID0gMDtcbiAgICAgICAgbWludXRlID0gMDtcbiAgICAgICAgbWVyaWRpZW0gPSAtMTtcbiAgICAgICAgaWYgKHNlY29uZE1hdGNoW1NFQ09ORF9HUk9VUF0pIHtcbiAgICAgICAgICAgIGxldCBzZWNvbmQgPSBwYXJzZUludChzZWNvbmRNYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChpc05hTihzZWNvbmQpKSB7XG4gICAgICAgICAgICAgICAgc2Vjb25kID0gemhTdHJpbmdUb051bWJlcihzZWNvbmRNYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzZWNvbmQgPj0gNjApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcInNlY29uZFwiLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIGhvdXIgPSBwYXJzZUludChzZWNvbmRNYXRjaFtIT1VSX0dST1VQXSk7XG4gICAgICAgIGlmIChpc05hTihob3VyKSkge1xuICAgICAgICAgICAgaG91ciA9IHpoU3RyaW5nVG9OdW1iZXIoc2Vjb25kTWF0Y2hbSE9VUl9HUk9VUF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZWNvbmRNYXRjaFtNSU5VVEVfR1JPVVBdKSB7XG4gICAgICAgICAgICBpZiAoc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBcIuWNilwiKSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gMzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzZWNvbmRNYXRjaFtNSU5VVEVfR1JPVVBdID09IFwi5q2jXCIgfHwgc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBcIuaVtFwiKSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIG1pbnV0ZSA9IHBhcnNlSW50KHNlY29uZE1hdGNoW01JTlVURV9HUk9VUF0pO1xuICAgICAgICAgICAgICAgIGlmIChpc05hTihtaW51dGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbnV0ZSA9IHpoU3RyaW5nVG9OdW1iZXIoc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGhvdXIgPiAxMDApIHtcbiAgICAgICAgICAgIG1pbnV0ZSA9IGhvdXIgJSAxMDA7XG4gICAgICAgICAgICBob3VyID0gTWF0aC5mbG9vcihob3VyIC8gMTAwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWludXRlID49IDYwKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG91ciA+IDI0KSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG91ciA+PSAxMikge1xuICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzZWNvbmRNYXRjaFtBTV9QTV9IT1VSX0dST1VQXSkge1xuICAgICAgICAgICAgaWYgKGhvdXIgPiAxMilcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGFtcG0gPSBzZWNvbmRNYXRjaFtBTV9QTV9IT1VSX0dST1VQXVswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJhXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJwXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSkge1xuICAgICAgICAgICAgICAgIGlmIChtZXJpZGllbSA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDApO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgPT0gMTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJob3VyXCIsIDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5nZXQoXCJob3VyXCIpICE9IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzZWNvbmRNYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCB6aEFNUE1TdHJpbmcxID0gc2Vjb25kTWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8xXTtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTTEgPSB6aEFNUE1TdHJpbmcxWzBdO1xuICAgICAgICAgICAgaWYgKHpoQU1QTTEgPT0gXCLml6lcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0xID09IFwi5pmaXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2Vjb25kTWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8yXSkge1xuICAgICAgICAgICAgY29uc3QgemhBTVBNU3RyaW5nMiA9IHNlY29uZE1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMl07XG4gICAgICAgICAgICBjb25zdCB6aEFNUE0yID0gemhBTVBNU3RyaW5nMlswXTtcbiAgICAgICAgICAgIGlmICh6aEFNUE0yID09IFwi5LiKXCIgfHwgemhBTVBNMiA9PSBcIuaXqVwiIHx8IHpoQU1QTTIgPT0gXCLlh4xcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMDtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh6aEFNUE0yID09IFwi5LiLXCIgfHwgemhBTVBNMiA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNlY29uZE1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTVN0cmluZzMgPSBzZWNvbmRNYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzNdO1xuICAgICAgICAgICAgY29uc3QgemhBTVBNMyA9IHpoQU1QTVN0cmluZzNbMF07XG4gICAgICAgICAgICBpZiAoemhBTVBNMyA9PSBcIuS4ilwiIHx8IHpoQU1QTTMgPT0gXCLml6lcIiB8fCB6aEFNUE0zID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMyA9PSBcIuS4i1wiIHx8IHpoQU1QTTMgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQudGV4dCA9IHJlc3VsdC50ZXh0ICsgc2Vjb25kTWF0Y2hbMF07XG4gICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwiaG91clwiLCBob3VyKTtcbiAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJtaW51dGVcIiwgbWludXRlKTtcbiAgICAgICAgaWYgKG1lcmlkaWVtID49IDApIHtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwibWVyaWRpZW1cIiwgbWVyaWRpZW0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc3RhcnRBdFBNID0gcmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihcIm1lcmlkaWVtXCIpICYmIHJlc3VsdC5zdGFydC5nZXQoXCJtZXJpZGllbVwiKSA9PSAxO1xuICAgICAgICAgICAgaWYgKHN0YXJ0QXRQTSAmJiByZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSA+IGhvdXIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwibWVyaWRpZW1cIiwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChob3VyID4gMTIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC5lbmQuZGF0ZSgpLmdldFRpbWUoKSA8IHJlc3VsdC5zdGFydC5kYXRlKCkuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwiZGF5XCIsIHJlc3VsdC5lbmQuZ2V0KFwiZGF5XCIpICsgMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNUaW1lRXhwcmVzc2lvblBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IFdFRUtEQVlfT0ZGU0VUIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzrmmJ/mnJ9856S85oucfOWRqCkoPzx3ZWVrZGF5PlwiICsgT2JqZWN0LmtleXMoV0VFS0RBWV9PRkZTRVQpLmpvaW4oXCJ8XCIpICsgXCIpXCIpO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zV2Vla2RheVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGNvbnN0IGRheU9mV2VlayA9IG1hdGNoLmdyb3Vwcy53ZWVrZGF5O1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBXRUVLREFZX09GRlNFVFtkYXlPZldlZWtdO1xuICAgICAgICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKGNvbnRleHQucmVmRGF0ZS5nZXRUaW1lKCkpO1xuICAgICAgICBjb25zdCBzdGFydE1vbWVudEZpeGVkID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHJlZk9mZnNldCA9IGRhdGUuZ2V0RGF5KCk7XG4gICAgICAgIGxldCBkaWZmID0gb2Zmc2V0IC0gcmVmT2Zmc2V0O1xuICAgICAgICBpZiAoTWF0aC5hYnMoZGlmZiAtIDcpIDwgTWF0aC5hYnMoZGlmZikpIHtcbiAgICAgICAgICAgIGRpZmYgLT0gNztcbiAgICAgICAgfVxuICAgICAgICBpZiAoTWF0aC5hYnMoZGlmZiArIDcpIDwgTWF0aC5hYnMoZGlmZikpIHtcbiAgICAgICAgICAgIGRpZmYgKz0gNztcbiAgICAgICAgfVxuICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyBkaWZmKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIndlZWtkYXlcIiwgb2Zmc2V0KTtcbiAgICAgICAgaWYgKHN0YXJ0TW9tZW50Rml4ZWQpIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVpISGFuc1dlZWtkYXlQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBOT1dfR1JPVVAgPSAxO1xuY29uc3QgREFZX0dST1VQXzEgPSAyO1xuY29uc3QgVElNRV9HUk9VUF8xID0gMztcbmNvbnN0IFRJTUVfR1JPVVBfMiA9IDQ7XG5jb25zdCBEQVlfR1JPVVBfMyA9IDU7XG5jb25zdCBUSU1FX0dST1VQXzMgPSA2O1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oY29udGV4dCkge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ0V4cChcIijnjrDlnKh856uLKD865Yi7fOWNsyl85Y2z5Yi7KXxcIiArXG4gICAgICAgICAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKOaXqXzmmZopfFwiICtcbiAgICAgICAgICAgIFwiKOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKXxcIiArXG4gICAgICAgICAgICBcIijku4p85piOfOWJjXzlpKfliY185ZCOfOWkp+WQjnzmmKgpKD865pelfOWkqSlcIiArXG4gICAgICAgICAgICBcIig/OltcXFxcc3wsfO+8jF0qKVwiICtcbiAgICAgICAgICAgIFwiKD86KOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKSk/XCIsIFwiaVwiKTtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gbWF0Y2guaW5kZXg7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChpbmRleCwgbWF0Y2hbMF0pO1xuICAgICAgICBjb25zdCByZWZEYXRlID0gY29udGV4dC5yZWZEYXRlO1xuICAgICAgICBsZXQgZGF0ZSA9IG5ldyBEYXRlKHJlZkRhdGUuZ2V0VGltZSgpKTtcbiAgICAgICAgaWYgKG1hdGNoW05PV19HUk9VUF0pIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgcmVmRGF0ZS5nZXRIb3VycygpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1pbnV0ZVwiLCByZWZEYXRlLmdldE1pbnV0ZXMoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJzZWNvbmRcIiwgcmVmRGF0ZS5nZXRTZWNvbmRzKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWlsbGlzZWNvbmRcIiwgcmVmRGF0ZS5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbREFZX0dST1VQXzFdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkxID0gbWF0Y2hbREFZX0dST1VQXzFdO1xuICAgICAgICAgICAgY29uc3QgdGltZTEgPSBtYXRjaFtUSU1FX0dST1VQXzFdO1xuICAgICAgICAgICAgaWYgKGRheTEgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGlmIChyZWZEYXRlLmdldEhvdXJzKCkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLmmKhcIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWJjVwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLlkI5cIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWkp+WQjlwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGltZTEgPT0gXCLml6lcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgNik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aW1lMSA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAyMik7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbVElNRV9HUk9VUF8yXSkge1xuICAgICAgICAgICAgY29uc3QgdGltZVN0cmluZzIgPSBtYXRjaFtUSU1FX0dST1VQXzJdO1xuICAgICAgICAgICAgY29uc3QgdGltZTIgPSB0aW1lU3RyaW5nMlswXTtcbiAgICAgICAgICAgIGlmICh0aW1lMiA9PSBcIuaXqVwiIHx8IHRpbWUyID09IFwi5LiKXCIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTIgPT0gXCLkuItcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMTUpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTIgPT0gXCLkuK1cIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMTIpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTIgPT0gXCLlpJxcIiB8fCB0aW1lMiA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAyMik7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmICh0aW1lMiA9PSBcIuWHjFwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtYXRjaFtEQVlfR1JPVVBfM10pIHtcbiAgICAgICAgICAgIGNvbnN0IGRheTMgPSBtYXRjaFtEQVlfR1JPVVBfM107XG4gICAgICAgICAgICBpZiAoZGF5MyA9PSBcIuaYjlwiKSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlZkRhdGUuZ2V0SG91cnMoKSA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuaYqFwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKfliY1cIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSAtIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWQjlwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5aSn5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHRpbWVTdHJpbmczID0gbWF0Y2hbVElNRV9HUk9VUF8zXTtcbiAgICAgICAgICAgIGlmICh0aW1lU3RyaW5nMykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRpbWUzID0gdGltZVN0cmluZzNbMF07XG4gICAgICAgICAgICAgICAgaWYgKHRpbWUzID09IFwi5pepXCIgfHwgdGltZTMgPT0gXCLkuIpcIikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aW1lMyA9PSBcIuS4i1wiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMTUpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGltZTMgPT0gXCLkuK1cIikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDEyKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUzID09IFwi5aScXCIgfHwgdGltZTMgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDIyKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUzID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNDYXN1YWxEYXRlUGFyc2VyLmpzLm1hcCIsImltcG9ydCBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3JlZmluZXJzL0Fic3RyYWN0TWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBaSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIgZXh0ZW5kcyBBYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lciB7XG4gICAgcGF0dGVybkJldHdlZW4oKSB7XG4gICAgICAgIHJldHVybiAvXlxccyoo6IezfOWIsHwtfH58772efO+8jXzjg7wpXFxzKiQvaTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIuanMubWFwIiwiaW1wb3J0IEFic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIgZnJvbSBcIi4uLy4uLy4uLy4uL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBaSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lciBleHRlbmRzIEFic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIge1xuICAgIHBhdHRlcm5CZXR3ZWVuKCkge1xuICAgICAgICByZXR1cm4gL15cXHMqJC9pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVpISGFuc01lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzLm1hcCIsImltcG9ydCBFeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyIGZyb20gXCIuLi8uLi8uLi9jb21tb24vcmVmaW5lcnMvRXh0cmFjdFRpbWV6b25lT2Zmc2V0UmVmaW5lci5qc1wiO1xuaW1wb3J0IHsgaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24gfSBmcm9tIFwiLi4vLi4vLi4vY29uZmlndXJhdGlvbnMuanNcIjtcbmltcG9ydCB7IENocm9ubyB9IGZyb20gXCIuLi8uLi8uLi9jaHJvbm8uanNcIjtcbmltcG9ydCB7IFBhcnNpbmdSZXN1bHQsIFBhcnNpbmdDb21wb25lbnRzLCBSZWZlcmVuY2VXaXRoVGltZXpvbmUgfSBmcm9tIFwiLi4vLi4vLi4vcmVzdWx0cy5qc1wiO1xuaW1wb3J0IHsgTWVyaWRpZW0sIFdlZWtkYXkgfSBmcm9tIFwiLi4vLi4vLi4vdHlwZXMuanNcIjtcbmltcG9ydCBaSEhhbnNDYXN1YWxEYXRlUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc0RhdGVQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9aSEhhbnNEYXRlUGFyc2VyLmpzXCI7XG5pbXBvcnQgWkhIYW5zRGVhZGxpbmVGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9aSEhhbnNEZWFkbGluZUZvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL1pISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc1RpbWVFeHByZXNzaW9uUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zVGltZUV4cHJlc3Npb25QYXJzZXIuanNcIjtcbmltcG9ydCBaSEhhbnNXZWVrZGF5UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zV2Vla2RheVBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc01lcmdlRGF0ZVJhbmdlUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9aSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIuanNcIjtcbmltcG9ydCBaSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9aSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lci5qc1wiO1xuZXhwb3J0IHsgQ2hyb25vLCBQYXJzaW5nUmVzdWx0LCBQYXJzaW5nQ29tcG9uZW50cywgUmVmZXJlbmNlV2l0aFRpbWV6b25lIH07XG5leHBvcnQgeyBNZXJpZGllbSwgV2Vla2RheSB9O1xuZXhwb3J0IGNvbnN0IGhhbnMgPSBuZXcgQ2hyb25vKGNyZWF0ZUNhc3VhbENvbmZpZ3VyYXRpb24oKSk7XG5leHBvcnQgY29uc3QgY2FzdWFsID0gbmV3IENocm9ubyhjcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCkpO1xuZXhwb3J0IGNvbnN0IHN0cmljdCA9IG5ldyBDaHJvbm8oY3JlYXRlQ29uZmlndXJhdGlvbigpKTtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZSh0ZXh0LCByZWYsIG9wdGlvbikge1xuICAgIHJldHVybiBjYXN1YWwucGFyc2UodGV4dCwgcmVmLCBvcHRpb24pO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRGF0ZSh0ZXh0LCByZWYsIG9wdGlvbikge1xuICAgIHJldHVybiBjYXN1YWwucGFyc2VEYXRlKHRleHQsIHJlZiwgb3B0aW9uKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCkge1xuICAgIGNvbnN0IG9wdGlvbiA9IGNyZWF0ZUNvbmZpZ3VyYXRpb24oKTtcbiAgICBvcHRpb24ucGFyc2Vycy51bnNoaWZ0KG5ldyBaSEhhbnNDYXN1YWxEYXRlUGFyc2VyKCkpO1xuICAgIHJldHVybiBvcHRpb247XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29uZmlndXJhdGlvbigpIHtcbiAgICBjb25zdCBjb25maWd1cmF0aW9uID0gaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24oe1xuICAgICAgICBwYXJzZXJzOiBbXG4gICAgICAgICAgICBuZXcgWkhIYW5zRGF0ZVBhcnNlcigpLFxuICAgICAgICAgICAgbmV3IFpISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlcigpLFxuICAgICAgICAgICAgbmV3IFpISGFuc1dlZWtkYXlQYXJzZXIoKSxcbiAgICAgICAgICAgIG5ldyBaSEhhbnNUaW1lRXhwcmVzc2lvblBhcnNlcigpLFxuICAgICAgICAgICAgbmV3IFpISGFuc0RlYWRsaW5lRm9ybWF0UGFyc2VyKCksXG4gICAgICAgIF0sXG4gICAgICAgIHJlZmluZXJzOiBbbmV3IFpISGFuc01lcmdlRGF0ZVJhbmdlUmVmaW5lcigpLCBuZXcgWkhIYW5zTWVyZ2VEYXRlVGltZVJlZmluZXIoKV0sXG4gICAgfSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycyA9IGNvbmZpZ3VyYXRpb24ucmVmaW5lcnMuZmlsdGVyKChyZWZpbmVyKSA9PiAhKHJlZmluZXIgaW5zdGFuY2VvZiBFeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyKSk7XG4gICAgcmV0dXJuIGNvbmZpZ3VyYXRpb247XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5qcy5tYXAiLCJpbXBvcnQgKiBhcyBjaHJvbm8gZnJvbSBcImNocm9uby1ub2RlXCI7XG5pbXBvcnQgeyBDaHJvbm8sIFBhcnNlciwgUGFyc2luZ0NvbnRleHQgfSBmcm9tIFwiY2hyb25vLW5vZGVcIjtcbmltcG9ydCB7IG1vbWVudCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgeyBEYXlPZldlZWsgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHtcbiAgWkhfUkVMQVRJVkVfREFZUyxcbiAgWkhfU1BFQ0lBTF9EQVRFUyxcbiAgWkhfT1JESU5BTFMsXG4gIFpIX1RISVMsXG4gIFpIX05FWFQsXG4gIFpIX1dFRUtfV09SRFMsXG4gIFpIX01PTlRIX1dPUkRTLFxuICBaSF9ZRUFSX1dPUkRTLFxuICBaSF9QT1NJVElPTixcbn0gZnJvbSBcIi4vbG9jYWxlXCI7XG5pbXBvcnQgeyBnZXRMYXN0RGF5T2ZNb250aCwgZ2V0TG9jYWxlV2Vla1N0YXJ0IH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBOTERSZXN1bHQge1xuICBmb3JtYXR0ZWRTdHJpbmc6IHN0cmluZztcbiAgZGF0ZTogRGF0ZTtcbiAgbW9tZW50OiBtb21lbnQuTW9tZW50O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVaaENocm9ubygpOiBDaHJvbm8ge1xuICBjb25zdCB6aENvbmZpZyA9IGNocm9uby56aC5oYW5zLmNyZWF0ZUNhc3VhbENvbmZpZ3VyYXRpb24oKTtcbiAgY29uc3QgemhDaHJvbm8gPSBuZXcgQ2hyb25vKHpoQ29uZmlnKTtcblxuICAvLyBDdXN0b20gUGFyc2VyIDE6IOeJueauiuWFrOWOhuaXpeacn++8iOWFg+aXpuOAgeWbveW6huOAgeWco+ivnuetie+8iVxuICBjb25zdCBzcGVjaWFsS2V5cyA9IE9iamVjdC5rZXlzKFpIX1NQRUNJQUxfREFURVMpLnNvcnQoXG4gICAgKGE6IHN0cmluZywgYjogc3RyaW5nKSA9PiBiLmxlbmd0aCAtIGEubGVuZ3RoXG4gICk7XG4gIGlmIChzcGVjaWFsS2V5cy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3Qgc3BlY2lhbFBhdHRlcm4gPSBzcGVjaWFsS2V5cy5qb2luKFwifFwiKTtcbiAgICB6aENocm9uby5wYXJzZXJzLnB1c2goe1xuICAgICAgcGF0dGVybjogKCkgPT4gbmV3IFJlZ0V4cChzcGVjaWFsUGF0dGVybiksXG4gICAgICBleHRyYWN0OiAoX2NvbnRleHQ6IFBhcnNpbmdDb250ZXh0LCBtYXRjaDogUmVnRXhwTWF0Y2hBcnJheSkgPT4ge1xuICAgICAgICBjb25zdCBkYXRlID0gWkhfU1BFQ0lBTF9EQVRFU1ttYXRjaFswXSBhcyBzdHJpbmddO1xuICAgICAgICBpZiAoZGF0ZSkge1xuICAgICAgICAgIHJldHVybiB7IGRheTogZGF0ZS5kYXksIG1vbnRoOiBkYXRlLm1vbnRoIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgIH0gYXMgUGFyc2VyKTtcbiAgfVxuXG4gIC8vIEN1c3RvbSBQYXJzZXIgMjog5Lit5paH5bqP5pWw6K+N44CM56ys5LiA44CN44CM56ys5LqM44CNLi4uIOOAjOesrOS4ieWNgeS4gOOAjVxuICBjb25zdCBvcmRpbmFsS2V5cyA9IE9iamVjdC5rZXlzKFpIX09SRElOQUxTKS5zb3J0KFxuICAgIChhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4gYi5sZW5ndGggLSBhLmxlbmd0aFxuICApO1xuICBjb25zdCBvcmRpbmFsUGF0dGVybiA9IG9yZGluYWxLZXlzLmpvaW4oXCJ8XCIpO1xuICB6aENocm9uby5wYXJzZXJzLnB1c2goe1xuICAgIHBhdHRlcm46ICgpID0+IG5ldyBSZWdFeHAoYOesrCgke29yZGluYWxQYXR0ZXJufSlgKSxcbiAgICBleHRyYWN0OiAoX2NvbnRleHQ6IFBhcnNpbmdDb250ZXh0LCBtYXRjaDogUmVnRXhwTWF0Y2hBcnJheSkgPT4ge1xuICAgICAgY29uc3QgbnVtID0gWkhfT1JESU5BTFNbbWF0Y2hbMV0gYXMgc3RyaW5nXTtcbiAgICAgIGlmIChudW0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4geyBkYXk6IG51bSwgbW9udGg6IG1vbWVudCgpLm1vbnRoKCkgKyAxIH07XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICB9IGFzIFBhcnNlcik7XG5cbiAgLy8gQ3VzdG9tIFBhcnNlciAzOiDnm7jlr7nml6XvvIjlkI7lpKnjgIHlpKflkI7lpKnjgIHliY3lpKnjgIHlpKfliY3lpKnvvIlcbiAgLy8gY2hyb25vIHpoLmhhbnMg5Y+q6KaG55uW5LuK5aSpL+aYjuWkqS/mmKjlpKlcbiAgY29uc3QgcmVsYXRpdmVFbnRyaWVzOiBbc3RyaW5nLCBudW1iZXJdW10gPSBPYmplY3QuZW50cmllcyhaSF9SRUxBVElWRV9EQVlTKVxuICAgIC5maWx0ZXIoXG4gICAgICAoWywgb2Zmc2V0XTogW3N0cmluZywgbnVtYmVyXSkgPT5cbiAgICAgICAgb2Zmc2V0ICE9PSAwICYmIG9mZnNldCAhPT0gMSAmJiBvZmZzZXQgIT09IC0xXG4gICAgKVxuICAgIC5zb3J0KFxuICAgICAgKGE6IFtzdHJpbmcsIG51bWJlcl0sIGI6IFtzdHJpbmcsIG51bWJlcl0pID0+IGJbMF0ubGVuZ3RoIC0gYVswXS5sZW5ndGhcbiAgICApO1xuXG4gIGlmIChyZWxhdGl2ZUVudHJpZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHJlbFBhdHRlcm4gPSByZWxhdGl2ZUVudHJpZXMubWFwKChba106IFtzdHJpbmcsIG51bWJlcl0pID0+IGspLmpvaW4oXCJ8XCIpO1xuICAgIHpoQ2hyb25vLnBhcnNlcnMucHVzaCh7XG4gICAgICBwYXR0ZXJuOiAoKSA9PiBuZXcgUmVnRXhwKHJlbFBhdHRlcm4pLFxuICAgICAgZXh0cmFjdDogKGNvbnRleHQ6IGFueSwgbWF0Y2g6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBaSF9SRUxBVElWRV9EQVlTW21hdGNoWzBdIGFzIHN0cmluZ107XG4gICAgICAgIGlmIChvZmZzZXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGNvbnN0IHJlZkRhdGUgPSBjb250ZXh0LnJlZkRhdGUgfHwgbmV3IERhdGUoKTtcbiAgICAgICAgICBjb25zdCB0YXJnZXQgPSBuZXcgRGF0ZShyZWZEYXRlKTtcbiAgICAgICAgICB0YXJnZXQuc2V0RGF0ZSh0YXJnZXQuZ2V0RGF0ZSgpICsgb2Zmc2V0KTtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZGF5OiB0YXJnZXQuZ2V0RGF0ZSgpLFxuICAgICAgICAgICAgbW9udGg6IHRhcmdldC5nZXRNb250aCgpICsgMSxcbiAgICAgICAgICAgIHllYXI6IHRhcmdldC5nZXRGdWxsWWVhcigpLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9LFxuICAgIH0gYXMgUGFyc2VyKTtcbiAgfVxuXG4gIHJldHVybiB6aENocm9ubztcbn1cblxuLy8g5p6E5bu655So5LqO5q2j5YiZ55qE5qih5byP54mH5q61XG5mdW5jdGlvbiBidWlsZFBhdHRlcm4od29yZHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgcmV0dXJuIHdvcmRzLnNvcnQoKGE6IHN0cmluZywgYjogc3RyaW5nKSA9PiBiLmxlbmd0aCAtIGEubGVuZ3RoKS5qb2luKFwifFwiKTtcbn1cblxuY29uc3QgVEhJU19QQVRURVJOID0gYnVpbGRQYXR0ZXJuKFpIX1RISVMpO1xuY29uc3QgTkVYVF9QQVRURVJOID0gYnVpbGRQYXR0ZXJuKFpIX05FWFQpO1xuY29uc3QgV0VFS19QQVRURVJOID0gYnVpbGRQYXR0ZXJuKFpIX1dFRUtfV09SRFMpO1xuY29uc3QgTU9OVEhfUEFUVEVSTiA9IGJ1aWxkUGF0dGVybihaSF9NT05USF9XT1JEUyk7XG5jb25zdCBZRUFSX1BBVFRFUk4gPSBidWlsZFBhdHRlcm4oWkhfWUVBUl9XT1JEUyk7XG5jb25zdCBFTkRfT0ZfTU9OVEhfUEFUVEVSTiA9IGJ1aWxkUGF0dGVybihaSF9QT1NJVElPTi5lbmRPZk1vbnRoKTtcbmNvbnN0IE1JRF9PRl9NT05USF9QQVRURVJOID0gYnVpbGRQYXR0ZXJuKFpIX1BPU0lUSU9OLm1pZE9mTW9udGgpO1xuXG4vLyDlronlhajop6PmnpDml6XmnJ/vvIzlpLHotKXml7bov5Tlm57lvZPliY3ml6XmnJ9cbmZ1bmN0aW9uIHNhZmVQYXJzZURhdGUocGFyc2VyOiBDaHJvbm8sIHRleHQ6IHN0cmluZywgcmVmRGF0ZT86IERhdGUsIG9wdGlvbj86IGNocm9uby5QYXJzaW5nT3B0aW9uKTogRGF0ZSB7XG4gIGNvbnN0IHJlc3VsdCA9IHBhcnNlci5wYXJzZURhdGUodGV4dCwgcmVmRGF0ZSwgb3B0aW9uKTtcbiAgcmV0dXJuIHJlc3VsdCA/PyBuZXcgRGF0ZSgpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBOTERQYXJzZXIge1xuICBjaHJvbm86IENocm9ubztcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmNocm9ubyA9IGNyZWF0ZVpoQ2hyb25vKCk7XG4gIH1cblxuICBnZXRQYXJzZWREYXRlKHNlbGVjdGVkVGV4dDogc3RyaW5nLCB3ZWVrU3RhcnRQcmVmZXJlbmNlOiBEYXlPZldlZWspOiBEYXRlIHtcbiAgICBjb25zdCBwYXJzZXIgPSB0aGlzLmNocm9ubztcbiAgICBjb25zdCBpbml0aWFsUGFyc2UgPSBwYXJzZXIucGFyc2Uoc2VsZWN0ZWRUZXh0KTtcbiAgICBjb25zdCB3ZWVrZGF5SXNDZXJ0YWluID0gaW5pdGlhbFBhcnNlWzBdPy5zdGFydC5pc0NlcnRhaW4oXCJ3ZWVrZGF5XCIpO1xuXG4gICAgY29uc3Qgd2Vla1N0YXJ0ID1cbiAgICAgIHdlZWtTdGFydFByZWZlcmVuY2UgPT09IFwibG9jYWxlLWRlZmF1bHRcIlxuICAgICAgICA/IGdldExvY2FsZVdlZWtTdGFydCgpXG4gICAgICAgIDogd2Vla1N0YXJ0UHJlZmVyZW5jZTtcblxuICAgIC8vIC0tLS0g54m55q6K5qih5byP5aSE55CGIC0tLS1cblxuICAgIC8vIOOAjOi/meWRqCAvIOacrOWRqCAvIOi/meS4quaYn+acn+OAjeKGkiDmnKzlkajnrKzkuIDlpKlcbiAgICBjb25zdCB0aGlzV2Vla1JlID0gbmV3IFJlZ0V4cChcbiAgICAgIGBeKD86JHtUSElTX1BBVFRFUk59KVxcXFxzKig/OiR7V0VFS19QQVRURVJOfSkkYFxuICAgICk7XG4gICAgaWYgKHRoaXNXZWVrUmUudGVzdChzZWxlY3RlZFRleHQudHJpbSgpKSkge1xuICAgICAgcmV0dXJuIHNhZmVQYXJzZURhdGUocGFyc2VyLCBg5pys5ZGoJHt3ZWVrU3RhcnR9YCwgbmV3IERhdGUoKSk7XG4gICAgfVxuXG4gICAgLy8g44CM5LiL5ZGoIC8g5LiL5Liq5pif5pyf44CN4oaSIOS4i+WRqOesrOS4gOWkqVxuICAgIGNvbnN0IG5leHRXZWVrUmUgPSBuZXcgUmVnRXhwKFxuICAgICAgYF4oPzoke05FWFRfUEFUVEVSTn0pXFxcXHMqKD86JHtXRUVLX1BBVFRFUk59KSRgXG4gICAgKTtcbiAgICBpZiAobmV4dFdlZWtSZS50ZXN0KHNlbGVjdGVkVGV4dC50cmltKCkpKSB7XG4gICAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIGDkuIvlkagke3dlZWtTdGFydH1gLCBuZXcgRGF0ZSgpLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g44CM5LiL5Liq5pyIIC8g5LiL5pyI44CNXG4gICAgY29uc3QgbmV4dE1vbnRoUmUgPSBuZXcgUmVnRXhwKFxuICAgICAgYF4oPzoke05FWFRfUEFUVEVSTn0pXFxcXHMqKD86JHtNT05USF9QQVRURVJOfSkkYFxuICAgICk7XG4gICAgaWYgKG5leHRNb250aFJlLnRlc3Qoc2VsZWN0ZWRUZXh0LnRyaW0oKSkpIHtcbiAgICAgIGNvbnN0IHRoaXNNb250aCA9IHNhZmVQYXJzZURhdGUocGFyc2VyLCBcIuacrOaciFwiLCBuZXcgRGF0ZSgpLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIHNlbGVjdGVkVGV4dCwgdGhpc01vbnRoLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g44CM5piO5bm0IC8g5p2l5bm044CNXG4gICAgY29uc3QgbmV4dFllYXJSZSA9IG5ldyBSZWdFeHAoXG4gICAgICBgXig/OiR7TkVYVF9QQVRURVJOfXzmmI4pXFxcXHMqKD86JHtZRUFSX1BBVFRFUk59KSRgXG4gICAgKTtcbiAgICBpZiAobmV4dFllYXJSZS50ZXN0KHNlbGVjdGVkVGV4dC50cmltKCkpKSB7XG4gICAgICBjb25zdCB0aGlzWWVhciA9IHNhZmVQYXJzZURhdGUocGFyc2VyLCBcIuS7iuW5tFwiLCBuZXcgRGF0ZSgpLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIHNlbGVjdGVkVGV4dCwgdGhpc1llYXIsIHtcbiAgICAgICAgZm9yd2FyZERhdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjgIzmnIjlupUgLyDmnIjmnKvjgI3ihpIg5b2T5pyI5pyA5ZCO5LiA5aSpXG4gICAgY29uc3QgZW5kT2ZNb250aFJlID0gbmV3IFJlZ0V4cChcbiAgICAgIGAoJHtFTkRfT0ZfTU9OVEhfUEFUVEVSTn0pXFxcXHMqKFteXFxcXG5cXFxccl0qKWBcbiAgICApO1xuICAgIGNvbnN0IGVuZE9mTW9udGhNYXRjaCA9IHNlbGVjdGVkVGV4dC5tYXRjaChlbmRPZk1vbnRoUmUpO1xuICAgIGlmIChlbmRPZk1vbnRoTWF0Y2gpIHtcbiAgICAgIGNvbnN0IGNvbnRleHRTdHIgPSBlbmRPZk1vbnRoTWF0Y2hbMl0udHJpbSgpIHx8IFwi5pys5pyIXCI7XG4gICAgICBjb25zdCB0ZW1wRGF0ZSA9IHBhcnNlci5wYXJzZShjb250ZXh0U3RyKTtcbiAgICAgIGNvbnN0IHllYXIgPVxuICAgICAgICB0ZW1wRGF0ZVswXT8uc3RhcnQuZ2V0KFwieWVhclwiKSA/PyBtb21lbnQoKS55ZWFyKCk7XG4gICAgICBjb25zdCBtb250aCA9XG4gICAgICAgIHRlbXBEYXRlWzBdPy5zdGFydC5nZXQoXCJtb250aFwiKSA/PyBtb21lbnQoKS5tb250aCgpICsgMTtcbiAgICAgIGNvbnN0IGxhc3REYXkgPSBnZXRMYXN0RGF5T2ZNb250aCh5ZWFyLCBtb250aCk7XG4gICAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShcbiAgICAgICAgcGFyc2VyLFxuICAgICAgICBgJHt5ZWFyfS0ke21vbnRofS0ke2xhc3REYXl9YCxcbiAgICAgICAgbmV3IERhdGUoKSxcbiAgICAgICAgeyBmb3J3YXJkRGF0ZTogdHJ1ZSB9XG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOOAjOaciOS4reOAjeKGkiDlvZPmnIggMTUg5pelXG4gICAgY29uc3QgbWlkT2ZNb250aFJlID0gbmV3IFJlZ0V4cChcbiAgICAgIGAoJHtNSURfT0ZfTU9OVEhfUEFUVEVSTn0pXFxcXHMqKFteXFxcXG5cXFxccl0qKWBcbiAgICApO1xuICAgIGNvbnN0IG1pZE9mTW9udGhNYXRjaCA9IHNlbGVjdGVkVGV4dC5tYXRjaChtaWRPZk1vbnRoUmUpO1xuICAgIGlmIChtaWRPZk1vbnRoTWF0Y2gpIHtcbiAgICAgIGNvbnN0IGNvbnRleHRTdHIgPSBtaWRPZk1vbnRoTWF0Y2hbMl0udHJpbSgpIHx8IFwi5pys5pyIXCI7XG4gICAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIGAke2NvbnRleHRTdHJ9IDE15pelYCwgbmV3IERhdGUoKSwge1xuICAgICAgICBmb3J3YXJkRGF0ZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOm7mOiupO+8muS6pOe7mSBjaHJvbm8gemguaGFucyDop6PmnpBcbiAgICBjb25zdCByZWZlcmVuY2VEYXRlID0gd2Vla2RheUlzQ2VydGFpblxuICAgICAgPyBtb21lbnQoKS53ZWVrZGF5KDApLnRvRGF0ZSgpXG4gICAgICA6IG5ldyBEYXRlKCk7XG5cbiAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIHNlbGVjdGVkVGV4dCwgcmVmZXJlbmNlRGF0ZSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgTmF0dXJhbExhbmd1YWdlRGF0ZXMgZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHsgZ2V0TG9jYWxlV2Vla1N0YXJ0IH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuZXhwb3J0IHR5cGUgRGF5T2ZXZWVrID1cbiAgfCBcInN1bmRheVwiXG4gIHwgXCJtb25kYXlcIlxuICB8IFwidHVlc2RheVwiXG4gIHwgXCJ3ZWRuZXNkYXlcIlxuICB8IFwidGh1cnNkYXlcIlxuICB8IFwiZnJpZGF5XCJcbiAgfCBcInNhdHVyZGF5XCJcbiAgfCBcImxvY2FsZS1kZWZhdWx0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTkxEU2V0dGluZ3Mge1xuICBhdXRvc3VnZ2VzdFRvZ2dsZUxpbms6IGJvb2xlYW47XG4gIGF1dG9jb21wbGV0ZVRyaWdnZXJQaHJhc2U6IHN0cmluZztcbiAgaXNBdXRvc3VnZ2VzdEVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgZm9ybWF0OiBzdHJpbmc7XG4gIGRlZmF1bHRBbGlhczogc3RyaW5nO1xuICB3ZWVrU3RhcnQ6IERheU9mV2VlaztcblxuICBtb2RhbFRvZ2dsZUxpbms6IGJvb2xlYW47XG4gIG1vZGFsTW9tZW50Rm9ybWF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBOTERTZXR0aW5ncyA9IHtcbiAgYXV0b3N1Z2dlc3RUb2dnbGVMaW5rOiB0cnVlLFxuICBhdXRvY29tcGxldGVUcmlnZ2VyUGhyYXNlOiBcIkBcIixcbiAgaXNBdXRvc3VnZ2VzdEVuYWJsZWQ6IHRydWUsXG5cbiAgZm9ybWF0OiBcIllZWVktTU0tRERcIixcbiAgZGVmYXVsdEFsaWFzOiBcIlwiLFxuICB3ZWVrU3RhcnQ6IFwibG9jYWxlLWRlZmF1bHRcIixcblxuICBtb2RhbFRvZ2dsZUxpbms6IGZhbHNlLFxuICBtb2RhbE1vbWVudEZvcm1hdDogXCJZWVlZLU1NLUREXCIsXG59O1xuXG5jb25zdCB3ZWVrZGF5cyA9IFtcbiAgXCJzdW5kYXlcIixcbiAgXCJtb25kYXlcIixcbiAgXCJ0dWVzZGF5XCIsXG4gIFwid2VkbmVzZGF5XCIsXG4gIFwidGh1cnNkYXlcIixcbiAgXCJmcmlkYXlcIixcbiAgXCJzYXR1cmRheVwiLFxuXTtcblxuZXhwb3J0IGNsYXNzIE5MRFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXM7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXMpIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29uc3QgbG9jYWxpemVkV2Vla2RheXMgPSB3aW5kb3cubW9tZW50LndlZWtkYXlzKCk7XG4gICAgY29uc3QgbG9jYWxlV2Vla1N0YXJ0ID0gZ2V0TG9jYWxlV2Vla1N0YXJ0KCk7XG5cbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCLmoLzlvI9cIikuc2V0SGVhZGluZygpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIuaXpeacn+agvOW8j1wiKVxuICAgICAgLnNldERlc2MoXCLml6XmnJ/nmoTmmL7npLrmoLzlvI/vvIzkvb/nlKggTW9tZW50LmpzIOagvOW8j+Wtl+espuS4slwiKVxuICAgICAgLmFkZE1vbWVudEZvcm1hdCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXREZWZhdWx0Rm9ybWF0KFwiWVlZWS1NTS1ERFwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb3JtYXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9ybWF0ID0gdmFsdWUgfHwgXCJZWVlZLU1NLUREXCI7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLkuIDlkajku47lkajlh6DlvIDlp4tcIilcbiAgICAgIC5zZXREZXNjKFwi6YCJ5oup5LiA5ZGo55qE6LW35aeL5pelXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcbiAgICAgICAgICBcImxvY2FsZS1kZWZhdWx0XCIsXG4gICAgICAgICAgYOezu+e7n+m7mOiupO+8iCR7U3RyaW5nKGxvY2FsZVdlZWtTdGFydCl977yJYFxuICAgICAgICApO1xuICAgICAgICBsb2NhbGl6ZWRXZWVrZGF5cy5mb3JFYWNoKChkYXksIGkpID0+IHtcbiAgICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24od2Vla2RheXNbaV0sIGRheSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogRGF5T2ZXZWVrKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud2Vla1N0YXJ0ID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIuiHquWKqOW7uuiurlwiKS5zZXRIZWFkaW5nKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwi5ZCv55So5pel5pyf6Ieq5Yqo5bu66K6uXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgYOW8gOWQr+WQju+8jOi+k+WFpSAke3RoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9jb21wbGV0ZVRyaWdnZXJQaHJhc2V9IOS8muinpuWPkeaXpeacn+W7uuiuruiPnOWNlWBcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmlzQXV0b3N1Z2dlc3RFbmFibGVkKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmlzQXV0b3N1Z2dlc3RFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLop6blj5HlrZfnrKZcIilcbiAgICAgIC5zZXREZXNjKFwi6L6T5YWl5q2k5a2X56ym6Kem5Y+R6Ieq5Yqo5bu66K6uXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkBcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b2NvbXBsZXRlVHJpZ2dlclBocmFzZSB8fCBcIkBcIilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvY29tcGxldGVUcmlnZ2VyUGhyYXNlID0gdmFsdWUudHJpbSgpIHx8IFwiQFwiO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwi5pel5pyf5YyF6KO55Li66ZO+5o6lXCIpXG4gICAgICAuc2V0RGVzYyhcIuW8gOWQr+WQju+8jOiHquWKqOW7uuiurueahOaXpeacn+S8muWMheijueWcqCBbW3dpa2lsaW5rXV0g5LitXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvc3VnZ2VzdFRvZ2dsZUxpbmspXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b3N1Z2dlc3RUb2dnbGVMaW5rID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLpk77mjqXpu5jorqTliKvlkI3moLzlvI9cIilcbiAgICAgIC5zZXREZXNjKFwi5Yib5bu6IHdpa2kg6ZO+5o6l5pe255qE6buY6K6k5Yir5ZCN5qC85byP77yITW9tZW50LmpzIOagvOW8j++8ie+8jOeVmeepuuWImeaXoOWIq+WQjVwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCLkvovlpoLvvJpNTeaciERE5pelXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZmF1bHRBbGlhcylcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0QWxpYXMgPSB2YWx1ZSB8fCBcIlwiO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgfVxufVxuIiwiaW1wb3J0IHtcbiAgQXBwLFxuICBFZGl0b3IsXG4gIEVkaXRvclBvc2l0aW9uLFxuICBFZGl0b3JTdWdnZXN0LFxuICBFZGl0b3JTdWdnZXN0Q29udGV4dCxcbiAgRWRpdG9yU3VnZ2VzdFRyaWdnZXJJbmZvLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE5hdHVyYWxMYW5ndWFnZURhdGVzIGZyb20gXCJzcmMvbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVNYXJrZG93bkxpbmssIGdldERhdGVMaW5rQWxpYXMgfSBmcm9tIFwic3JjL3V0aWxzXCI7XG5pbXBvcnQge1xuICBaSF9XRUVLREFZU19TSE9SVCxcbiAgWkhfV0VFS0RBWVNfTE9ORyxcbn0gZnJvbSBcInNyYy9sb2NhbGVcIjtcblxuaW50ZXJmYWNlIElEYXRlQ29tcGxldGlvbiB7XG4gIGxhYmVsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIERhdGVTdWdnZXN0IGV4dGVuZHMgRWRpdG9yU3VnZ2VzdDxJRGF0ZUNvbXBsZXRpb24+IHtcbiAgYXBwOiBBcHA7XG4gIHByaXZhdGUgcGx1Z2luOiBOYXR1cmFsTGFuZ3VhZ2VEYXRlcztcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBOYXR1cmFsTGFuZ3VhZ2VEYXRlcykge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cbiAgICB0aGlzLnNjb3BlLnJlZ2lzdGVyKFtcIlNoaWZ0XCJdLCBcIkVudGVyXCIsIChldnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICAgIChcbiAgICAgICAgdGhpcyBhcyB1bmtub3duIGFzIHtcbiAgICAgICAgICBzdWdnZXN0aW9uczogeyB1c2VTZWxlY3RlZEl0ZW0oZXZ0OiBLZXlib2FyZEV2ZW50KTogdm9pZCB9O1xuICAgICAgICB9XG4gICAgICApLnN1Z2dlc3Rpb25zLnVzZVNlbGVjdGVkSXRlbShldnQpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9zdWdnZXN0VG9nZ2xlTGluaykge1xuICAgICAgdGhpcy5zZXRJbnN0cnVjdGlvbnMoW1xuICAgICAgICB7IGNvbW1hbmQ6IFwiU2hpZnRcIiwgcHVycG9zZTogXCLkvb/nlKjljp/lp4vovpPlhaXkvZzkuLrliKvlkI1cIiB9LFxuICAgICAgXSk7XG4gICAgfVxuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMoY29udGV4dDogRWRpdG9yU3VnZ2VzdENvbnRleHQpOiBJRGF0ZUNvbXBsZXRpb25bXSB7XG4gICAgY29uc3Qgc3VnZ2VzdGlvbnMgPSB0aGlzLmdldERhdGVTdWdnZXN0aW9ucyhjb250ZXh0KTtcbiAgICBpZiAoc3VnZ2VzdGlvbnMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gc3VnZ2VzdGlvbnM7XG4gICAgfVxuICAgIHJldHVybiBbeyBsYWJlbDogY29udGV4dC5xdWVyeSB9XTtcbiAgfVxuXG4gIGdldERhdGVTdWdnZXN0aW9ucyhcbiAgICBjb250ZXh0OiBFZGl0b3JTdWdnZXN0Q29udGV4dCB8IHsgcXVlcnk6IHN0cmluZyB9LFxuICAgIGRlZmF1bHRzOiBzdHJpbmdbXSA9IFtcIuS7iuWkqVwiLCBcIuaYjuWkqVwiLCBcIuaYqOWkqVwiLCBcIuWQjuWkqVwiXVxuICApOiBJRGF0ZUNvbXBsZXRpb25bXSB7XG4gICAgY29uc3QgcXVlcnkgPSBjb250ZXh0LnF1ZXJ5LnRyaW0oKTtcblxuICAgIC8vIOS4iuS4i+aWh+WMuemFje+8muOAjOS4i+OAjeKGkiDkuIvlkajjgIHkuIvkuKrmnIjjgIHkuIvlkajkuIB+5ZGo5pelXG4gICAgaWYgKC9e5LiLLy50ZXN0KHF1ZXJ5KSkge1xuICAgICAgY29uc3Qgc3VnZ2VzdGlvbnMgPSBbXG4gICAgICAgIFwi5LiL5ZGoXCIsXG4gICAgICAgIFwi5LiL5Liq5pyIXCIsXG4gICAgICAgIFwi5LiL5bm0XCIsXG4gICAgICAgIC4uLlpIX1dFRUtEQVlTX1NIT1JULm1hcCgoZCkgPT4gYOS4iyR7ZH1gKSxcbiAgICAgICAgLi4uWkhfV0VFS0RBWVNfTE9ORy5tYXAoKGQpID0+IGDkuIske2R9YCksXG4gICAgICBdO1xuICAgICAgcmV0dXJuIHN1Z2dlc3Rpb25zXG4gICAgICAgIC5tYXAoKGxhYmVsKSA9PiAoeyBsYWJlbCB9KSlcbiAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5sYWJlbC5zdGFydHNXaXRoKHF1ZXJ5KSk7XG4gICAgfVxuXG4gICAgLy8g44CM5LiK44CN4oaSIOS4iuWRqOOAgeS4iuS4quaciOOAgeS4iuWRqOS4gH7lkajml6VcbiAgICBpZiAoL17kuIovLnRlc3QocXVlcnkpKSB7XG4gICAgICBjb25zdCBzdWdnZXN0aW9ucyA9IFtcbiAgICAgICAgXCLkuIrlkahcIixcbiAgICAgICAgXCLkuIrkuKrmnIhcIixcbiAgICAgICAgXCLkuIrlubRcIixcbiAgICAgICAgLi4uWkhfV0VFS0RBWVNfU0hPUlQubWFwKChkKSA9PiBg5LiKJHtkfWApLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19MT05HLm1hcCgoZCkgPT4gYOS4iiR7ZH1gKSxcbiAgICAgIF07XG4gICAgICByZXR1cm4gc3VnZ2VzdGlvbnNcbiAgICAgICAgLm1hcCgobGFiZWwpID0+ICh7IGxhYmVsIH0pKVxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICB9XG5cbiAgICAvLyDjgIzov5kv5pys44CN4oaSIOi/meWRqOOAgei/meS4quaciFxuICAgIGlmICgvXijov5l85pysKS8udGVzdChxdWVyeSkpIHtcbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gW1wi6L+Z5ZGoXCIsIFwi6L+Z5Liq5pyIXCJdO1xuICAgICAgcmV0dXJuIHN1Z2dlc3Rpb25zXG4gICAgICAgIC5tYXAoKGxhYmVsKSA9PiAoeyBsYWJlbCB9KSlcbiAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5sYWJlbC5zdGFydHNXaXRoKHF1ZXJ5KSk7XG4gICAgfVxuXG4gICAgLy8g5pWw5a2X5byA5aS077yaTuWkqeWQjuOAgU7lpKnliY3jgIFO5ZGo5ZCOLi4uXG4gICAgY29uc3QgbnVtTWF0Y2ggPSBxdWVyeS5tYXRjaCgvXihcXGQrKS8pO1xuICAgIGlmIChudW1NYXRjaCkge1xuICAgICAgY29uc3QgbiA9IG51bU1hdGNoWzFdO1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgYCR7bn3lpKnlkI5gLFxuICAgICAgICBgJHtufeWkqeWJjWAsXG4gICAgICAgIGAke2595ZGo5ZCOYCxcbiAgICAgICAgYCR7bn3lkajliY1gLFxuICAgICAgICBgJHtufeS4quaciOWQjmAsXG4gICAgICAgIGAke2595Liq5pyI5YmNYCxcbiAgICAgIF1cbiAgICAgICAgLm1hcCgobGFiZWwpID0+ICh7IGxhYmVsIH0pKVxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICB9XG5cbiAgICAvLyDkuK3mlofmlbDlrZflvIDlpLTvvJrkuInlpKnlkI7jgIHkupTlpKnlkI4uLi5cbiAgICBjb25zdCB6aE51bU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIFwi5LiAXCI6IFwiMVwiLCBcIuS6jFwiOiBcIjJcIiwgXCLkuIlcIjogXCIzXCIsIFwi5ZubXCI6IFwiNFwiLCBcIuS6lFwiOiBcIjVcIixcbiAgICAgIFwi5YWtXCI6IFwiNlwiLCBcIuS4g1wiOiBcIjdcIiwgXCLlhatcIjogXCI4XCIsIFwi5LmdXCI6IFwiOVwiLCBcIuWNgVwiOiBcIjEwXCIsXG4gICAgfTtcbiAgICBjb25zdCB6aE51bU1hdGNoID0gcXVlcnkubWF0Y2goL14oW+S4gOS6jOS4ieWbm+S6lOWFreS4g+WFq+S5neWNgV0pLyk7XG4gICAgaWYgKHpoTnVtTWF0Y2gpIHtcbiAgICAgIGNvbnN0IG4gPSB6aE51bU1hcFt6aE51bU1hdGNoWzFdXTtcbiAgICAgIGlmIChuKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgYCR7emhOdW1NYXRjaFsxXX3lpKnlkI5gLFxuICAgICAgICAgIGAke3poTnVtTWF0Y2hbMV195aSp5YmNYCxcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeWRqOWQjmAsXG4gICAgICAgICAgYCR7emhOdW1NYXRjaFsxXX3lkajliY1gLFxuICAgICAgICAgIGAke3poTnVtTWF0Y2hbMV195Liq5pyI5ZCOYCxcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeS4quaciOWJjWAsXG4gICAgICAgIF1cbiAgICAgICAgICAubWFwKChsYWJlbCkgPT4gKHsgbGFiZWwgfSkpXG4gICAgICAgICAgLmZpbHRlcigoaXRlbSkgPT4gaXRlbS5sYWJlbC5zdGFydHNXaXRoKHF1ZXJ5KSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlZmF1bHRzXG4gICAgICAubWFwKChsYWJlbCkgPT4gKHsgbGFiZWwgfSkpXG4gICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oc3VnZ2VzdGlvbjogSURhdGVDb21wbGV0aW9uLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5zZXRUZXh0KHN1Z2dlc3Rpb24ubGFiZWwpO1xuICB9XG5cbiAgc2VsZWN0U3VnZ2VzdGlvbihcbiAgICBzdWdnZXN0aW9uOiBJRGF0ZUNvbXBsZXRpb24sXG4gICAgZXZlbnQ6IEtleWJvYXJkRXZlbnQgfCBNb3VzZUV2ZW50XG4gICk6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmNvbnRleHQ7XG4gICAgaWYgKCFjb250ZXh0KSByZXR1cm47XG5cbiAgICBjb25zdCB7IGVkaXRvciB9ID0gY29udGV4dDtcblxuICAgIGNvbnN0IGluY2x1ZGVBbGlhcyA9IGV2ZW50LnNoaWZ0S2V5O1xuICAgIGxldCBtYWtlSW50b0xpbmsgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvc3VnZ2VzdFRvZ2dsZUxpbms7XG5cbiAgICBjb25zdCBwYXJzZWREYXRlID0gdGhpcy5wbHVnaW4ucGFyc2VEYXRlKHN1Z2dlc3Rpb24ubGFiZWwpO1xuICAgIGxldCBkYXRlU3RyID0gcGFyc2VkRGF0ZS5mb3JtYXR0ZWRTdHJpbmc7XG5cbiAgICBpZiAobWFrZUludG9MaW5rKSB7XG4gICAgICBjb25zdCBhbGlhcyA9IGluY2x1ZGVBbGlhc1xuICAgICAgICA/IGNvbnRleHQucXVlcnkgfHwgc3VnZ2VzdGlvbi5sYWJlbFxuICAgICAgICA6IGdldERhdGVMaW5rQWxpYXModGhpcy5wbHVnaW4sIHN1Z2dlc3Rpb24ubGFiZWwsIGZhbHNlKSB8fCBzdWdnZXN0aW9uLmxhYmVsO1xuICAgICAgZGF0ZVN0ciA9IGdlbmVyYXRlTWFya2Rvd25MaW5rKHRoaXMuYXBwLCBkYXRlU3RyLCBhbGlhcyk7XG4gICAgfVxuXG4gICAgZWRpdG9yLnJlcGxhY2VSYW5nZShkYXRlU3RyLCBjb250ZXh0LnN0YXJ0LCBjb250ZXh0LmVuZCk7XG4gICAgdGhpcy5jbG9zZSgpO1xuICB9XG5cbiAgb25UcmlnZ2VyKFxuICAgIGN1cnNvcjogRWRpdG9yUG9zaXRpb24sXG4gICAgZWRpdG9yOiBFZGl0b3JcbiAgKTogRWRpdG9yU3VnZ2VzdFRyaWdnZXJJbmZvIHwgbnVsbCB7XG4gICAgaWYgKCF0aGlzLnBsdWdpbi5zZXR0aW5ncy5pc0F1dG9zdWdnZXN0RW5hYmxlZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgdHJpZ2dlclBocmFzZSA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9jb21wbGV0ZVRyaWdnZXJQaHJhc2U7XG4gICAgY29uc3Qgc3RhcnRQb3MgPSB0aGlzLmNvbnRleHQ/LnN0YXJ0IHx8IHtcbiAgICAgIGxpbmU6IGN1cnNvci5saW5lLFxuICAgICAgY2g6IGN1cnNvci5jaCAtIHRyaWdnZXJQaHJhc2UubGVuZ3RoLFxuICAgIH07XG5cbiAgICBpZiAoIWVkaXRvci5nZXRSYW5nZShzdGFydFBvcywgY3Vyc29yKS5zdGFydHNXaXRoKHRyaWdnZXJQaHJhc2UpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVjZWRpbmdDaGFyID0gZWRpdG9yLmdldFJhbmdlKFxuICAgICAge1xuICAgICAgICBsaW5lOiBzdGFydFBvcy5saW5lLFxuICAgICAgICBjaDogc3RhcnRQb3MuY2ggLSAxLFxuICAgICAgfSxcbiAgICAgIHN0YXJ0UG9zXG4gICAgKTtcblxuICAgIC8vIOmBv+WFjeWcqOmCrueuseWcsOWdgOetieWcuuaZr+ivr+inpuWPkVxuICAgIGlmIChwcmVjZWRpbmdDaGFyICYmIC9bYGEtekEtWjAtOV0vLnRlc3QocHJlY2VkaW5nQ2hhcikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHF1ZXJ5ID0gZWRpdG9yXG4gICAgICAuZ2V0UmFuZ2Uoc3RhcnRQb3MsIGN1cnNvcilcbiAgICAgIC5zdWJzdHJpbmcodHJpZ2dlclBocmFzZS5sZW5ndGgpO1xuXG4gICAgLy8g6Kem5Y+R5a2X56ym5ZCO57Sn6Lef56m65qC85YiZ5Y+W5raIXG4gICAgaWYgKHF1ZXJ5ID09PSBcIiBcIikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXJ0OiBzdGFydFBvcyxcbiAgICAgIGVuZDogY3Vyc29yLFxuICAgICAgcXVlcnksXG4gICAgfTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgTWFya2Rvd25WaWV3IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBhZGp1c3RDdXJzb3IsIGdldFNlbGVjdGVkVGV4dCwgZ2V0RGF0ZUxpbmtBbGlhcyB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgdHlwZSBOYXR1cmFsTGFuZ3VhZ2VEYXRlcyBmcm9tIFwiLi9tYWluXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQYXJzZUNvbW1hbmQoXG4gIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXMsXG4gIG1vZGU6IHN0cmluZ1xuKTogdm9pZCB7XG4gIGNvbnN0IHsgd29ya3NwYWNlIH0gPSBwbHVnaW4uYXBwO1xuICBjb25zdCBhY3RpdmVWaWV3ID0gd29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcblxuICBpZiAoIWFjdGl2ZVZpZXcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBlZGl0b3IgPSBhY3RpdmVWaWV3LmVkaXRvcjtcbiAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xuICBjb25zdCBzZWxlY3RlZFRleHQgPSBnZXRTZWxlY3RlZFRleHQoZWRpdG9yKTtcblxuICBjb25zdCBkYXRlID0gcGx1Z2luLnBhcnNlRGF0ZShzZWxlY3RlZFRleHQpO1xuXG4gIGlmICghZGF0ZS5tb21lbnQuaXNWYWxpZCgpKSB7XG4gICAgZWRpdG9yLnNldEN1cnNvcih7XG4gICAgICBsaW5lOiBjdXJzb3IubGluZSxcbiAgICAgIGNoOiBjdXJzb3IuY2gsXG4gICAgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgbGV0IG5ld1N0cjogc3RyaW5nO1xuXG4gIGlmIChtb2RlID09PSBcInJlcGxhY2VcIikge1xuICAgIGNvbnN0IGFsaWFzID0gZ2V0RGF0ZUxpbmtBbGlhcyhwbHVnaW4sIHNlbGVjdGVkVGV4dCwgZmFsc2UpO1xuICAgIG5ld1N0ciA9IGFsaWFzXG4gICAgICA/IGBbWyR7ZGF0ZS5mb3JtYXR0ZWRTdHJpbmd9fCR7YWxpYXN9XV1gXG4gICAgICA6IGBbWyR7ZGF0ZS5mb3JtYXR0ZWRTdHJpbmd9XV1gO1xuICB9IGVsc2UgaWYgKG1vZGUgPT09IFwibGlua1wiKSB7XG4gICAgbmV3U3RyID0gYFske3NlbGVjdGVkVGV4dH1dKCR7ZGF0ZS5mb3JtYXR0ZWRTdHJpbmd9KWA7XG4gIH0gZWxzZSBpZiAobW9kZSA9PT0gXCJjbGVhblwiKSB7XG4gICAgbmV3U3RyID0gZGF0ZS5mb3JtYXR0ZWRTdHJpbmc7XG4gIH1cblxuICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbihuZXdTdHIhKTtcbiAgYWRqdXN0Q3Vyc29yKGVkaXRvciwgY3Vyc29yLCBuZXdTdHIhLCBzZWxlY3RlZFRleHQpO1xuICBlZGl0b3IuZm9jdXMoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluc2VydE1vbWVudENvbW1hbmQoXG4gIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXMsXG4gIGRhdGU6IERhdGUsXG4gIGZvcm1hdDogc3RyaW5nXG4pOiB2b2lkIHtcbiAgY29uc3QgeyB3b3Jrc3BhY2UgfSA9IHBsdWdpbi5hcHA7XG4gIGNvbnN0IGFjdGl2ZVZpZXcgPSB3b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuXG4gIGlmIChhY3RpdmVWaWV3KSB7XG4gICAgY29uc3QgZWRpdG9yID0gYWN0aXZlVmlldy5lZGl0b3I7XG4gICAgZWRpdG9yLnJlcGxhY2VTZWxlY3Rpb24od2luZG93Lm1vbWVudChkYXRlKS5mb3JtYXQoZm9ybWF0KSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEN1cnJlbnREYXRlQ29tbWFuZChwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzKTogdm9pZCB7XG4gIGNvbnN0IGZvcm1hdCA9IHBsdWdpbi5zZXR0aW5ncy5mb3JtYXQ7XG4gIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSgpO1xuICBpbnNlcnRNb21lbnRDb21tYW5kKHBsdWdpbiwgZGF0ZSwgZm9ybWF0KTtcbn1cbiIsImltcG9ydCB7IE5vdGljZSwgU3VnZ2VzdE1vZGFsLCBBcHAgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGdldE9yQ3JlYXRlRGFpbHlOb3RlIH0gZnJvbSBcIi4uL3V0aWxzXCI7XG5pbXBvcnQgdHlwZSBOYXR1cmFsTGFuZ3VhZ2VEYXRlcyBmcm9tIFwiLi4vbWFpblwiO1xuaW1wb3J0IERhdGVTdWdnZXN0IGZyb20gXCIuLi9zdWdnZXN0L2RhdGUtc3VnZ2VzdFwiO1xuXG5leHBvcnQgY2xhc3MgT3BlbkRhaWx5Tm90ZU1vZGFsIGV4dGVuZHMgU3VnZ2VzdE1vZGFsPHN0cmluZz4ge1xuICBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgICB0aGlzLnNldFBsYWNlaG9sZGVyKFwi6L6T5YWl5Lit5paH5pel5pyf77yM5aaC77ya5LuK5aSp44CB5LiL5ZGo5LiJ44CBM+WkqeWQjlwiKTtcbiAgfVxuXG4gIGdldFN1Z2dlc3Rpb25zKHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgdGVtcFN1Z2dlc3QgPSBuZXcgRGF0ZVN1Z2dlc3QodGhpcy5hcHAsIHRoaXMucGx1Z2luKTtcbiAgICBjb25zdCBzdWdnZXN0aW9ucyA9IHRlbXBTdWdnZXN0LmdldERhdGVTdWdnZXN0aW9ucyhcbiAgICAgIHsgcXVlcnkgfSxcbiAgICAgIFtcIuS7iuWkqVwiLCBcIuaYqOWkqVwiLCBcIuaYjuWkqVwiXVxuICAgICk7XG4gICAgcmV0dXJuIHN1Z2dlc3Rpb25zLm1hcCgocykgPT4gcy5sYWJlbCkubGVuZ3RoXG4gICAgICA/IHN1Z2dlc3Rpb25zLm1hcCgocykgPT4gcy5sYWJlbClcbiAgICAgIDogW3F1ZXJ5XTtcbiAgfVxuXG4gIHJlbmRlclN1Z2dlc3Rpb24oc3VnZ2VzdGlvbjogc3RyaW5nLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBlbC5jcmVhdGVFbChcImRpdlwiLCB7IHRleHQ6IHN1Z2dlc3Rpb24gfSk7XG4gIH1cblxuICBvbkNob29zZVN1Z2dlc3Rpb24oc3VnZ2VzdGlvbjogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgcGFyc2VkRGF0ZSA9IHRoaXMucGx1Z2luLnBhcnNlRGF0ZShzdWdnZXN0aW9uKTtcbiAgICBjb25zdCBkYXRlID0gcGFyc2VkRGF0ZS5tb21lbnQ7XG4gICAgaWYgKCFwYXJzZWREYXRlLmRhdGUgfHwgIWRhdGUuaXNWYWxpZCgpKSB7XG4gICAgICBuZXcgTm90aWNlKFwi5peg5rOV6Kej5p6Q6K+l5pel5pyfXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZvaWQgZ2V0T3JDcmVhdGVEYWlseU5vdGUoZGF0ZSkudGhlbigobm90ZSkgPT4ge1xuICAgICAgaWYgKG5vdGUpIHtcbiAgICAgICAgdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZigpLm9wZW5GaWxlKG5vdGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgeyBNYXJrZG93blZpZXcsIE9ic2lkaWFuUHJvdG9jb2xEYXRhLCBQbHVnaW4gfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IERhdGVQaWNrZXJNb2RhbCBmcm9tIFwiLi9tb2RhbHMvZGF0ZS1waWNrZXJcIjtcbmltcG9ydCBOTERQYXJzZXIsIHsgTkxEUmVzdWx0IH0gZnJvbSBcIi4vcGFyc2VyXCI7XG5pbXBvcnQgeyBOTERTZXR0aW5nc1RhYiwgTkxEU2V0dGluZ3MsIERFRkFVTFRfU0VUVElOR1MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IERhdGVTdWdnZXN0IGZyb20gXCIuL3N1Z2dlc3QvZGF0ZS1zdWdnZXN0XCI7XG5pbXBvcnQge1xuICBnZXRQYXJzZUNvbW1hbmQsXG4gIGdldEN1cnJlbnREYXRlQ29tbWFuZCxcbn0gZnJvbSBcIi4vY29tbWFuZHNcIjtcbmltcG9ydCB7IGdldEZvcm1hdHRlZERhdGUsIGdldE9yQ3JlYXRlRGFpbHlOb3RlLCBwYXJzZVRydXRoeSB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgeyBPcGVuRGFpbHlOb3RlTW9kYWwgfSBmcm9tIFwiLi9tb2RhbHMvb3Blbi1kYWlseS1ub3RlXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE5hdHVyYWxMYW5ndWFnZURhdGVzIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBwYXJzZXI6IE5MRFBhcnNlcjtcbiAgcHVibGljIHNldHRpbmdzOiBOTERTZXR0aW5ncztcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJubHAtZGF0ZXNcIixcbiAgICAgIG5hbWU6IFwi6Kej5p6Q6Ieq54S26K+t6KiA5pel5pyfXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4gZ2V0UGFyc2VDb21tYW5kKHRoaXMsIFwicmVwbGFjZVwiKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJubHAtZGF0ZXMtbGlua1wiLFxuICAgICAgbmFtZTogXCLop6PmnpDoh6rnhLbor63oqIDml6XmnJ/vvIhNYXJrZG93biDpk77mjqXvvIlcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiBnZXRQYXJzZUNvbW1hbmQodGhpcywgXCJsaW5rXCIpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm5scC1kYXRlLWNsZWFuXCIsXG4gICAgICBuYW1lOiBcIuino+aekOiHqueEtuivreiogOaXpeacn++8iOe6r+aWh+acrO+8iVwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IGdldFBhcnNlQ29tbWFuZCh0aGlzLCBcImNsZWFuXCIpLFxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcIm5scC10b2RheVwiLFxuICAgICAgbmFtZTogXCLmj5LlhaXlvZPliY3ml6XmnJ9cIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiBnZXRDdXJyZW50RGF0ZUNvbW1hbmQodGhpcyksXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibmxwLXBpY2tlclwiLFxuICAgICAgbmFtZTogXCLml6XmnJ/pgInmi6nlmahcIixcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xuICAgICAgICBpZiAoY2hlY2tpbmcpIHtcbiAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuICAgICAgICB9XG4gICAgICAgIG5ldyBEYXRlUGlja2VyTW9kYWwodGhpcy5hcHAsIHRoaXMpLm9wZW4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwibmxwLW9wZW4tZGFpbHktbm90ZVwiLFxuICAgICAgbmFtZTogXCLnlKjoh6rnhLbor63oqIDmiZPlvIDml6XorrBcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1vZGFsID0gbmV3IE9wZW5EYWlseU5vdGVNb2RhbCh0aGlzLmFwcCwgdGhpcyk7XG4gICAgICAgIG1vZGFsLm9wZW4oKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICB0aGlzLmFkZFNldHRpbmdUYWIobmV3IE5MRFNldHRpbmdzVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gICAgdGhpcy5yZWdpc3Rlck9ic2lkaWFuUHJvdG9jb2xIYW5kbGVyKFxuICAgICAgXCJubGRhdGVzXCIsXG4gICAgICAocGFyYW1zKSA9PiB2b2lkIHRoaXMuYWN0aW9uSGFuZGxlcihwYXJhbXMpXG4gICAgKTtcbiAgICB0aGlzLnJlZ2lzdGVyRWRpdG9yU3VnZ2VzdChuZXcgRGF0ZVN1Z2dlc3QodGhpcy5hcHAsIHRoaXMpKTtcblxuICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHtcbiAgICAgIHRoaXMucGFyc2VyID0gbmV3IE5MRFBhcnNlcigpO1xuICAgIH0pO1xuICB9XG5cbiAgb251bmxvYWQoKTogdm9pZCB7XG4gICAgY29uc29sZS5kZWJ1ZyhcIuWNuOi9veiHqueEtuivreiogOaXpeacn+aPkuS7tu+8iOS4reaWh++8iVwiKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbihcbiAgICAgIHt9LFxuICAgICAgREVGQVVMVF9TRVRUSU5HUyxcbiAgICAgIChhd2FpdCB0aGlzLmxvYWREYXRhKCkpIGFzIFBhcnRpYWw8TkxEU2V0dGluZ3M+XG4gICAgKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuICB9XG5cbiAgcGFyc2UoZGF0ZVN0cmluZzogc3RyaW5nLCBmb3JtYXQ6IHN0cmluZyk6IE5MRFJlc3VsdCB7XG4gICAgY29uc3QgZGF0ZSA9IHRoaXMucGFyc2VyLmdldFBhcnNlZERhdGUoXG4gICAgICBkYXRlU3RyaW5nLFxuICAgICAgdGhpcy5zZXR0aW5ncy53ZWVrU3RhcnRcbiAgICApO1xuICAgIGNvbnN0IGZvcm1hdHRlZFN0cmluZyA9IGdldEZvcm1hdHRlZERhdGUoZGF0ZSwgZm9ybWF0KTtcbiAgICBpZiAoZm9ybWF0dGVkU3RyaW5nID09PSBcIkludmFsaWQgZGF0ZVwiKSB7XG4gICAgICBjb25zb2xlLmRlYnVnKGBubGRhdGVzIOaXoOazleino+aekOi+k+WFpSBcIiR7ZGF0ZVN0cmluZ31cImApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBmb3JtYXR0ZWRTdHJpbmcsXG4gICAgICBkYXRlLFxuICAgICAgbW9tZW50OiB3aW5kb3cubW9tZW50KGRhdGUpLFxuICAgIH07XG4gIH1cblxuICBwYXJzZURhdGUoZGF0ZVN0cmluZzogc3RyaW5nKTogTkxEUmVzdWx0IHtcbiAgICByZXR1cm4gdGhpcy5wYXJzZShkYXRlU3RyaW5nLCB0aGlzLnNldHRpbmdzLmZvcm1hdCk7XG4gIH1cblxuICBhc3luYyBhY3Rpb25IYW5kbGVyKHBhcmFtczogT2JzaWRpYW5Qcm90b2NvbERhdGEpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG5cbiAgICBjb25zdCBkYXRlID0gdGhpcy5wYXJzZURhdGUocGFyYW1zLmRheSk7XG4gICAgY29uc3QgbmV3UGFuZSA9IHBhcnNlVHJ1dGh5KHBhcmFtcy5uZXdQYW5lIHx8IFwieWVzXCIpO1xuXG4gICAgaWYgKGRhdGUubW9tZW50LmlzVmFsaWQoKSkge1xuICAgICAgY29uc3QgZGFpbHlOb3RlID0gYXdhaXQgZ2V0T3JDcmVhdGVEYWlseU5vdGUoZGF0ZS5tb21lbnQpO1xuICAgICAgaWYgKGRhaWx5Tm90ZSkge1xuICAgICAgICBhd2FpdCB3b3Jrc3BhY2UuZ2V0TGVhZihuZXdQYW5lKS5vcGVuRmlsZShkYWlseU5vdGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbIm5vcm1hbGl6ZVBhdGgiLCJOb3RpY2UiLCJWYXVsdCIsIlRGaWxlIiwiTW9kYWwiLCJTZXR0aW5nIiwiTWFya2Rvd25WaWV3IiwiWUVBUl9QQVRURVJOIiwiUEFUVEVSTiIsIkRBVEVfR1JPVVAiLCJEQVRFX1RPX0dST1VQIiwiTU9OVEhfTkFNRV9HUk9VUCIsIllFQVJfR1JPVVAiLCJQUkVGSVhfR1JPVVAiLCJZRUFSX05VTUJFUl9HUk9VUCIsIk1PTlRIX05VTUJFUl9HUk9VUCIsIkRBVEVfTlVNQkVSX0dST1VQIiwiTU9OVEhfR1JPVVAiLCJIT1VSX0dST1VQIiwiTUlOVVRFX0dST1VQIiwiU0VDT05EX0dST1VQIiwiQU1fUE1fSE9VUl9HUk9VUCIsIlNUUklDVF9QQVRURVJOIiwiZGF0ZXMuaW1wbHlTaW1pbGFyRGF0ZSIsInJlZmVyZW5jZXMubm93IiwicmVmZXJlbmNlcy50b2RheSIsInJlZmVyZW5jZXMueWVzdGVyZGF5IiwicmVmZXJlbmNlcy50b21vcnJvdyIsInJlZmVyZW5jZXMudG9uaWdodCIsInJlZmVyZW5jZXMudGhlRGF5QWZ0ZXIiLCJjYXN1YWxSZWZlcmVuY2VzLmFmdGVybm9vbiIsImNhc3VhbFJlZmVyZW5jZXMuZXZlbmluZyIsImNhc3VhbFJlZmVyZW5jZXMubWlkbmlnaHQiLCJjYXN1YWxSZWZlcmVuY2VzLm1vcm5pbmciLCJjYXN1YWxSZWZlcmVuY2VzLm5vb24iLCJEQVlfR1JPVVBfMSIsIkRBWV9HUk9VUF8zIiwiY2hyb25vLnpoLmhhbnMuY3JlYXRlQ2FzdWFsQ29uZmlndXJhdGlvbiIsIm1vbWVudCIsIlBsdWdpblNldHRpbmdUYWIiLCJFZGl0b3JTdWdnZXN0IiwiU3VnZ2VzdE1vZGFsIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBcUJBLE1BQU0seUJBQXlCLEdBQUcsWUFBWSxDQUFDO0FBcUIvQyxTQUFTLE1BQU0sR0FBQTtJQUNiLE9BQVEsTUFBK0MsQ0FBQyxHQUFHLENBQUM7QUFDOUQsQ0FBQztBQUVELFNBQVMsOEJBQThCLENBQUMsV0FBbUIsRUFBQTs7SUFDekQsTUFBTSxNQUFNLEdBQUcsTUFBTSxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FFN0MsQ0FBQztBQUNkLElBQUEsT0FBTyxPQUFPLENBQUMsQ0FBQSxFQUFBLEdBQUEsQ0FBQSxFQUFBLEdBQUEsTUFBTSxhQUFOLE1BQU0sS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBTixNQUFNLENBQUUsUUFBUSxNQUFHLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLFdBQVcsQ0FBQyxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLE9BQU8sQ0FB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SSxFQUFFLElBQUksQ0FBQztJQUM3QixXQUFXLEVBQUUsQ0FBQyxJQUFJLENBQUM7Q0FDcEIsQ0FBQztBQUVGO0FBQ08sTUFBTSxnQkFBZ0IsR0FBbUQ7SUFDOUUsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzFCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDMUIsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzFCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMxQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDMUIsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzFCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDM0IsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzVCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUM3QixLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7SUFDN0IsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzVCLEtBQUssRUFBRSxFQUFF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TyxDQUFDO0FBQ3hDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDcEMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUN0QyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDO0FBQ3RDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUM7QUFDMUMsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQztBQUNoRCxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDO0FBQzdDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxVQUFVLENBQUM7QUFDL0MsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLFVBQVUsQ0FBQztBQUMvQyxDQUFDLEVBQUUsS0FBSyxLQUFLLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQzs7QUM1QmxCLFNBQVMsaUJBQWlCLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRTtBQUNyRCxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQzlDLElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3JELElBQUksU0FBUyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDbkQs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QUMsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRztBQUNiLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxLQUFLLEVBQUUsR0FBRztBQUNkLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxLQUFLLEVBQUUsR0FBRztBQUNkLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksS0FBSyxFQUFFLEdBQUc7QUFDZCxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsQ0FBQyxHQUFHO0FBQ2QsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRztBQUNiLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxFQUFFO0FBQ1gsSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRztBQUNiLElBQUksRUFBRSxFQUFFO0FBQ1IsUUFBUSx1QkFBdUIs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QUFDN0IsS0FBSztBQUNMLElBQUksSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDdkIsUUFBUSxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3hDLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0IsS0FBSztBQUNMLElBQUksSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDdkIsUUFBUSxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pDLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0IsS0FBSztBQUNMLElBQUksSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDdkIsUUFBUSxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzNDLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0IsS0FBSztBQUNMLElBQUksSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDdkIsUUFBUSxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzNDLFFBQVEsT0FBTyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0IsS0FBSztBQUNMLElBQUksSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDeEIsUUFBUSxRQUFRLENBQUMsYUFBYSxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pELFFBQVEsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDOUIsS0FBSztBQUNMLElBQUksSUFBSSxNQUFNLElBQUksUUFBUSxFQUFFO0FBQzVCLFFBQVEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUNuRCxRQUFRLElB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O0FBQ1QsS0FBSztBQUNMOztBQzFHTyxNQUFNLE1BQU0sR0FBRztBQUN0QixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixJQUFJLEdBQUcsRUFBRSxFQUFFO0FBQ1gsQ0FBQyxDQUFDO0FBQ0ssTUFBTSxjQUFjLEdBQUc7QUFDOUIsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNWLElBQUksR0FBRyxFQUFFLENBQUM7QUFDVixDQUFDLENBQUM7QUFDSyxTQUFTLGdCQUFnQixDQUFDLElBQUksRUFBRTtBQUN2QyxJQUFJLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztBQUNuQixJQUFJLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzFDLFFBQVEsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzdCLFFBQVEsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFO0FBQzFCLFlBQVksTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsTUFB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

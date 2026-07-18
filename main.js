'use strict';

var obsidian = require('obsidian');

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

/**
 * 中文日期词库：序数词、星期、相对日期、特殊日期（含繁简体）
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
    "週一", "週二", "週三", "週四", "週五", "週六", "週日",
];
const ZH_WEEKDAYS_ALT = [
    "礼拜一", "礼拜二", "礼拜三", "礼拜四", "礼拜五", "礼拜六", "礼拜天",
    "禮拜一", "禮拜二", "禮拜三", "禮拜四", "禮拜五", "禮拜六", "禮拜天",
];
// ---- 相对日期 ----
const ZH_RELATIVE_DAYS = {
    // 简体
    "今天": 0,
    "今日": 0,
    "明天": 1,
    "明日": 1,
    "后天": 2,
    "大后天": 3,
    "昨天": -1,
    "昨日": -1,
    "前天": -2,
    "大前天": -3,
    // 繁體
    "後天": 2,
    "大後天": 3,
};
// ---- 周期指示词 ----
const ZH_THIS = ["这个", "这", "本", "這個", "這"];
const ZH_NEXT = ["下个", "下", "来", "下個", "來"];
// ---- 周期单位 ----
const ZH_WEEK_WORDS = ["周", "星期", "礼拜", "週", "禮拜"];
const ZH_MONTH_WORDS = ["月", "月份"];
const ZH_YEAR_WORDS = ["年"];
// ---- 特殊位置 ----
const ZH_POSITION = {
    endOfMonth: ["月底", "月末"],
    midOfMonth: ["月中"],
    startOfMonth: ["月初"],
    endOfYear: ["年底", "年末", "年终", "年終"],
    startOfYear: ["年初"],
};
// ---- 特殊公历日期 ----
const ZH_SPECIAL_DATES = {
    // 简体
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
    "感恩节": { month: 11, day: 27 },
    "重阳": { month: 10, day: 9 },
    // 繁體
    "勞動節": { month: 5, day: 1 },
    "國慶": { month: 10, day: 1 },
    "聖誕": { month: 12, day: 25 },
    "聖誕節": { month: 12, day: 25 },
    "情人節": { month: 2, day: 14 },
    "愚人節": { month: 4, day: 1 },
    "萬聖節": { month: 10, day: 31 },
    "感恩節": { month: 11, day: 27 },
    "重陽": { month: 10, day: 9 },
    // 农历近似
    "除夕": { month: 1, day: 28 },
    "元宵": { month: 2, day: 12 },
    "端午": { month: 6, day: 1 },
    "中秋": { month: 9, day: 15 },
    "七夕": { month: 8, day: 4 },
};

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

// 繁体→简体日期字符映射，确保 chrono zh.hans 能正确解析繁体输入
const TRAD_TO_SIMP = {
    "週": "周",
    "禮": "礼",
    "個": "个",
    "這": "这",
    "來": "来",
    "節": "节",
    "勞": "劳",
    "動": "动",
    "國": "国",
    "慶": "庆",
    "聖": "圣",
    "誕": "诞",
    "萬": "万",
    "後": "后",
    "陽": "阳",
    "終": "终",
};
function normalizeTraditional(text) {
    let result = text;
    for (const [trad, simp] of Object.entries(TRAD_TO_SIMP)) {
        result = result.replace(new RegExp(trad, "g"), simp);
    }
    return result;
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
        var _a, _b, _c, _d, _e, _f, _g;
        const normalizedText = normalizeTraditional(selectedText);
        const parser = this.chrono;
        const initialParse = parser.parse(normalizedText);
        const weekdayIsCertain = (_a = initialParse[0]) === null || _a === void 0 ? void 0 : _a.start.isCertain("weekday");
        const weekStart = weekStartPreference === "locale-default"
            ? getLocaleWeekStart()
            : weekStartPreference;
        // ---- 特殊模式处理 ----
        // 「这周 / 本周 / 这个星期」→ 本周第一天
        const thisWeekRe = new RegExp(`^(?:${THIS_PATTERN})\\s*(?:${WEEK_PATTERN})$`);
        if (thisWeekRe.test(normalizedText.trim())) {
            return safeParseDate(parser, `本周${weekStart}`, new Date());
        }
        // 「下周 / 下个星期」→ 下周第一天
        const nextWeekRe = new RegExp(`^(?:${NEXT_PATTERN})\\s*(?:${WEEK_PATTERN})$`);
        if (nextWeekRe.test(normalizedText.trim())) {
            return safeParseDate(parser, `下周${weekStart}`, new Date(), {
                forwardDate: true,
            });
        }
        // 「下个月 / 下月」
        const nextMonthRe = new RegExp(`^(?:${NEXT_PATTERN})\\s*(?:${MONTH_PATTERN})$`);
        if (nextMonthRe.test(normalizedText.trim())) {
            const thisMonth = safeParseDate(parser, "本月", new Date(), {
                forwardDate: true,
            });
            return safeParseDate(parser, normalizedText, thisMonth, {
                forwardDate: true,
            });
        }
        // 「明年 / 来年」
        const nextYearRe = new RegExp(`^(?:${NEXT_PATTERN}|明)\\s*(?:${YEAR_PATTERN})$`);
        if (nextYearRe.test(normalizedText.trim())) {
            const thisYear = safeParseDate(parser, "今年", new Date(), {
                forwardDate: true,
            });
            return safeParseDate(parser, normalizedText, thisYear, {
                forwardDate: true,
            });
        }
        // 「月底 / 月末」→ 当月最后一天
        const endOfMonthRe = new RegExp(`(${END_OF_MONTH_PATTERN})\\s*([^\\n\\r]*)`);
        const endOfMonthMatch = normalizedText.match(endOfMonthRe);
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
        const midOfMonthMatch = normalizedText.match(midOfMonthRe);
        if (midOfMonthMatch) {
            const contextStr = midOfMonthMatch[2].trim() || "本月";
            return safeParseDate(parser, `${contextStr} 15日`, new Date(), {
                forwardDate: true,
            });
        }
        // 只对裸星期几（如「周五」而非「下周五」）使用 moment 计算，
        // 避免 chrono「最近匹配」策略受参考日期偏移影响而跳到上周。
        // 「下周五」等带修饰词的由 chrono 正常解析（isCertain("day")=true）。
        if (weekdayIsCertain && !((_f = initialParse[0]) === null || _f === void 0 ? void 0 : _f.start.isCertain("day"))) {
            const weekdayNum = (_g = initialParse[0]) === null || _g === void 0 ? void 0 : _g.start.get("weekday");
            if (typeof weekdayNum === "number") {
                // 将周几的名称转为数字 (Sunday=0)
                const toDayNum = (d) => {
                    switch (d) {
                        case "sunday": return 0;
                        case "monday": return 1;
                        case "tuesday": return 2;
                        case "wednesday": return 3;
                        case "thursday": return 4;
                        case "friday": return 5;
                        case "saturday": return 6;
                        default: return 1;
                    }
                };
                const startDay = weekStartPreference === "locale-default"
                    ? toDayNum(getLocaleWeekStart())
                    : toDayNum(weekStartPreference);
                const today = obsidian.moment();
                const weekStart = today.clone().day(startDay);
                if (weekStart.isAfter(today, "day")) {
                    weekStart.subtract(7, "days");
                }
                const offset = (weekdayNum - startDay + 7) % 7;
                return weekStart.add(offset, "days").toDate();
            }
        }
        return safeParseDate(parser, normalizedText, new Date());
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
                { command: "Shift+Enter", purpose: "使用纯日期" },
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
    getDateSuggestions(context, defaults = ["今天", "明天", "昨天", "后天", "後天"]) {
        const query = context.query.trim();
        // 上下文匹配：「下」→ 下周、下个月、下周一~周日
        if (/^下/.test(query)) {
            const suggestions = [
                "下周", "下週",
                "下个月", "下個月",
                "下年",
                ...ZH_WEEKDAYS_SHORT.map((d) => `下${d}`),
                ...ZH_WEEKDAYS_LONG.map((d) => `下${d}`),
                ...ZH_WEEKDAYS_ALT.map((d) => `下${d}`),
            ];
            return suggestions
                .map((label) => ({ label }))
                .filter((item) => item.label.startsWith(query));
        }
        // 「上」→ 上周、上个月、上周一~周日
        if (/^上/.test(query)) {
            const suggestions = [
                "上周", "上週",
                "上个月", "上個月",
                "上年",
                ...ZH_WEEKDAYS_SHORT.map((d) => `上${d}`),
                ...ZH_WEEKDAYS_LONG.map((d) => `上${d}`),
                ...ZH_WEEKDAYS_ALT.map((d) => `上${d}`),
            ];
            return suggestions
                .map((label) => ({ label }))
                .filter((item) => item.label.startsWith(query));
        }
        // 「这/本」→ 这周、这个月
        if (/^(这|本|這)/.test(query)) {
            const suggestions = [
                "这周", "這週",
                "这个月", "這個月",
                ...ZH_WEEKDAYS_SHORT.map((d) => `本${d}`),
                ...ZH_WEEKDAYS_LONG.map((d) => `本${d}`),
                ...ZH_WEEKDAYS_ALT.map((d) => `本${d}`),
            ];
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
                `${n}周后`, `${n}週後`,
                `${n}周前`, `${n}週前`,
                `${n}个月后`, `${n}個月後`,
                `${n}个月前`, `${n}個月前`,
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
                    `${zhNumMatch[1]}周后`, `${zhNumMatch[1]}週後`,
                    `${zhNumMatch[1]}周前`, `${zhNumMatch[1]}週前`,
                    `${zhNumMatch[1]}个月后`, `${zhNumMatch[1]}個月後`,
                    `${zhNumMatch[1]}个月前`, `${zhNumMatch[1]}個月前`,
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
        const skipAlias = event.shiftKey;
        let makeIntoLink = this.plugin.settings.autosuggestToggleLink;
        const parsedDate = this.plugin.parseDate(suggestion.label);
        let dateStr = parsedDate.formattedString;
        if (makeIntoLink) {
            const alias = skipAlias
                ? undefined
                : getDateLinkAlias(this.plugin, suggestion.label, false) || context.query || suggestion.label;
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
            id: "nlp-date-clean",
            name: "解析自然语言日期（纯文本）",
            callback: () => getParseCommand(this, "clean"),
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL3R5cGVzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL3V0aWxzL2RhdGVzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL3RpbWV6b25lLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL3Jlc3VsdHMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vdXRpbHMvcGF0dGVybi5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jYWxjdWxhdGlvbi95ZWFycy5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL2NvbnN0YW50cy5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOVGltZVVuaXRXaXRoaW5Gb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOTW9udGhOYW1lTGl0dGxlRW5kaWFuUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5Nb250aE5hbWVQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOWWVhck1vbnRoRGF5UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlNsYXNoTW9udGhGb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RUaW1lRXhwcmVzc2lvblBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5UaW1lRXhwcmVzc2lvblBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5UaW1lVW5pdEFnb0Zvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5UaW1lVW5pdExhdGVyRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9hYnN0cmFjdFJlZmluZXJzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3JlZmluZXJzL0VOTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NhbGN1bGF0aW9uL21lcmdpbmdDYWxjdWxhdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcmVmaW5lcnMvQWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3JlZmluZXJzL0VOTWVyZ2VEYXRlVGltZVJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL0V4dHJhY3RUaW1lem9uZUFiYnJSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9FeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9PdmVybGFwUmVtb3ZhbFJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY2FsY3VsYXRpb24vd2Vla2RheXMuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3JlZmluZXJzL0ZvcndhcmREYXRlUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcmVmaW5lcnMvVW5saWtlbHlGb3JtYXRGaWx0ZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vY29tbW9uL3BhcnNlcnMvSVNPRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9yZWZpbmVycy9NZXJnZVdlZWtkYXlDb21wb25lbnRSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbmZpZ3VyYXRpb25zLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2NvbW1vbi9jYXN1YWxSZWZlcmVuY2VzLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTkNhc3VhbERhdGVQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOQ2FzdWFsVGltZVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3BhcnNlcnMvRU5XZWVrZGF5UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcGFyc2Vycy9FTlJlbGF0aXZlRGF0ZUZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jb21tb24vcGFyc2Vycy9TbGFzaERhdGVGb3JtYXRQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9wYXJzZXJzL0VOVGltZVVuaXRDYXN1YWxSZWxhdGl2ZUZvcm1hdFBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL2VuL3JlZmluZXJzL0VOTWVyZ2VSZWxhdGl2ZUFmdGVyRGF0ZVJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9yZWZpbmVycy9FTk1lcmdlUmVsYXRpdmVGb2xsb3dCeURhdGVSZWZpbmVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vcmVmaW5lcnMvRU5FeHRyYWN0WWVhclN1ZmZpeFJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy9lbi9yZWZpbmVycy9FTlVubGlrZWx5Rm9ybWF0RmlsdGVyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvZW4vY29uZmlndXJhdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9jaHJvbm8uanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL2NvbnN0YW50cy5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvcGFyc2Vycy9aSEhhbnNEYXRlUGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc0RlYWRsaW5lRm9ybWF0UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvcGFyc2Vycy9aSEhhbnNUaW1lRXhwcmVzc2lvblBhcnNlci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvcGFyc2Vycy9aSEhhbnNXZWVrZGF5UGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2Nocm9uby1ub2RlL2Rpc3QvZXNtL2xvY2FsZXMvemgvaGFucy9wYXJzZXJzL1pISGFuc0Nhc3VhbERhdGVQYXJzZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL3JlZmluZXJzL1pISGFuc01lcmdlRGF0ZVJhbmdlUmVmaW5lci5qcyIsIm5vZGVfbW9kdWxlcy9jaHJvbm8tbm9kZS9kaXN0L2VzbS9sb2NhbGVzL3poL2hhbnMvcmVmaW5lcnMvWkhIYW5zTWVyZ2VEYXRlVGltZVJlZmluZXIuanMiLCJub2RlX21vZHVsZXMvY2hyb25vLW5vZGUvZGlzdC9lc20vbG9jYWxlcy96aC9oYW5zL2luZGV4LmpzIiwic3JjL2xvY2FsZS50cyIsInNyYy9kYWlseS1ub3Rlcy50cyIsInNyYy91dGlscy50cyIsInNyYy9wYXJzZXIudHMiLCJzcmMvc2V0dGluZ3MudHMiLCJzcmMvc3VnZ2VzdC9kYXRlLXN1Z2dlc3QudHMiLCJzcmMvY29tbWFuZHMudHMiLCJzcmMvbW9kYWxzL29wZW4tZGFpbHktbm90ZS50cyIsInNyYy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCB2YXIgTWVyaWRpZW07XG4oZnVuY3Rpb24gKE1lcmlkaWVtKSB7XG4gICAgTWVyaWRpZW1bTWVyaWRpZW1bXCJBTVwiXSA9IDBdID0gXCJBTVwiO1xuICAgIE1lcmlkaWVtW01lcmlkaWVtW1wiUE1cIl0gPSAxXSA9IFwiUE1cIjtcbn0pKE1lcmlkaWVtIHx8IChNZXJpZGllbSA9IHt9KSk7XG5leHBvcnQgdmFyIFdlZWtkYXk7XG4oZnVuY3Rpb24gKFdlZWtkYXkpIHtcbiAgICBXZWVrZGF5W1dlZWtkYXlbXCJTVU5EQVlcIl0gPSAwXSA9IFwiU1VOREFZXCI7XG4gICAgV2Vla2RheVtXZWVrZGF5W1wiTU9OREFZXCJdID0gMV0gPSBcIk1PTkRBWVwiO1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIlRVRVNEQVlcIl0gPSAyXSA9IFwiVFVFU0RBWVwiO1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIldFRE5FU0RBWVwiXSA9IDNdID0gXCJXRURORVNEQVlcIjtcbiAgICBXZWVrZGF5W1dlZWtkYXlbXCJUSFVSU0RBWVwiXSA9IDRdID0gXCJUSFVSU0RBWVwiO1xuICAgIFdlZWtkYXlbV2Vla2RheVtcIkZSSURBWVwiXSA9IDVdID0gXCJGUklEQVlcIjtcbiAgICBXZWVrZGF5W1dlZWtkYXlbXCJTQVRVUkRBWVwiXSA9IDZdID0gXCJTQVRVUkRBWVwiO1xufSkoV2Vla2RheSB8fCAoV2Vla2RheSA9IHt9KSk7XG5leHBvcnQgdmFyIE1vbnRoO1xuKGZ1bmN0aW9uIChNb250aCkge1xuICAgIE1vbnRoW01vbnRoW1wiSkFOVUFSWVwiXSA9IDFdID0gXCJKQU5VQVJZXCI7XG4gICAgTW9udGhbTW9udGhbXCJGRUJSVUFSWVwiXSA9IDJdID0gXCJGRUJSVUFSWVwiO1xuICAgIE1vbnRoW01vbnRoW1wiTUFSQ0hcIl0gPSAzXSA9IFwiTUFSQ0hcIjtcbiAgICBNb250aFtNb250aFtcIkFQUklMXCJdID0gNF0gPSBcIkFQUklMXCI7XG4gICAgTW9udGhbTW9udGhbXCJNQVlcIl0gPSA1XSA9IFwiTUFZXCI7XG4gICAgTW9udGhbTW9udGhbXCJKVU5FXCJdID0gNl0gPSBcIkpVTkVcIjtcbiAgICBNb250aFtNb250aFtcIkpVTFlcIl0gPSA3XSA9IFwiSlVMWVwiO1xuICAgIE1vbnRoW01vbnRoW1wiQVVHVVNUXCJdID0gOF0gPSBcIkFVR1VTVFwiO1xuICAgIE1vbnRoW01vbnRoW1wiU0VQVEVNQkVSXCJdID0gOV0gPSBcIlNFUFRFTUJFUlwiO1xuICAgIE1vbnRoW01vbnRoW1wiT0NUT0JFUlwiXSA9IDEwXSA9IFwiT0NUT0JFUlwiO1xuICAgIE1vbnRoW01vbnRoW1wiTk9WRU1CRVJcIl0gPSAxMV0gPSBcIk5PVkVNQkVSXCI7XG4gICAgTW9udGhbTW9udGhbXCJERUNFTUJFUlwiXSA9IDEyXSA9IFwiREVDRU1CRVJcIjtcbn0pKE1vbnRoIHx8IChNb250aCA9IHt9KSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10eXBlcy5qcy5tYXAiLCJpbXBvcnQgeyBNZXJpZGllbSB9IGZyb20gXCIuLi90eXBlcy5qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0KSB7XG4gICAgY29tcG9uZW50LmFzc2lnbihcImRheVwiLCB0YXJnZXQuZ2V0RGF0ZSgpKTtcbiAgICBjb21wb25lbnQuYXNzaWduKFwibW9udGhcIiwgdGFyZ2V0LmdldE1vbnRoKCkgKyAxKTtcbiAgICBjb21wb25lbnQuYXNzaWduKFwieWVhclwiLCB0YXJnZXQuZ2V0RnVsbFllYXIoKSk7XG59XG5leHBvcnQgZnVuY3Rpb24gYXNzaWduU2ltaWxhclRpbWUoY29tcG9uZW50LCB0YXJnZXQpIHtcbiAgICBjb21wb25lbnQuYXNzaWduKFwiaG91clwiLCB0YXJnZXQuZ2V0SG91cnMoKSk7XG4gICAgY29tcG9uZW50LmFzc2lnbihcIm1pbnV0ZVwiLCB0YXJnZXQuZ2V0TWludXRlcygpKTtcbiAgICBjb21wb25lbnQuYXNzaWduKFwic2Vjb25kXCIsIHRhcmdldC5nZXRTZWNvbmRzKCkpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJtaWxsaXNlY29uZFwiLCB0YXJnZXQuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgIGNvbXBvbmVudC5hc3NpZ24oXCJtZXJpZGllbVwiLCB0YXJnZXQuZ2V0SG91cnMoKSA8IDEyID8gTWVyaWRpZW0uQU0gOiBNZXJpZGllbS5QTSk7XG59XG5leHBvcnQgZnVuY3Rpb24gaW1wbHlTaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldCkge1xuICAgIGNvbXBvbmVudC5pbXBseShcImRheVwiLCB0YXJnZXQuZ2V0RGF0ZSgpKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtb250aFwiLCB0YXJnZXQuZ2V0TW9udGgoKSArIDEpO1xuICAgIGNvbXBvbmVudC5pbXBseShcInllYXJcIiwgdGFyZ2V0LmdldEZ1bGxZZWFyKCkpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGltcGx5U2ltaWxhclRpbWUoY29tcG9uZW50LCB0YXJnZXQpIHtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJob3VyXCIsIHRhcmdldC5nZXRIb3VycygpKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgdGFyZ2V0LmdldE1pbnV0ZXMoKSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIHRhcmdldC5nZXRTZWNvbmRzKCkpO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIHRhcmdldC5nZXRNaWxsaXNlY29uZHMoKSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgdGFyZ2V0LmdldEhvdXJzKCkgPCAxMiA/IE1lcmlkaWVtLkFNIDogTWVyaWRpZW0uUE0pO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0ZXMuanMubWFwIiwiaW1wb3J0IHsgV2Vla2RheSwgTW9udGggfSBmcm9tIFwiLi90eXBlcy5qc1wiO1xuZXhwb3J0IGNvbnN0IFRJTUVaT05FX0FCQlJfTUFQID0ge1xuICAgIEFDRFQ6IDYzMCxcbiAgICBBQ1NUOiA1NzAsXG4gICAgQURUOiAtMTgwLFxuICAgIEFFRFQ6IDY2MCxcbiAgICBBRVNUOiA2MDAsXG4gICAgQUZUOiAyNzAsXG4gICAgQUtEVDogLTQ4MCxcbiAgICBBS1NUOiAtNTQwLFxuICAgIEFMTVQ6IDM2MCxcbiAgICBBTVNUOiAtMTgwLFxuICAgIEFNVDogLTI0MCxcbiAgICBBTkFTVDogNzIwLFxuICAgIEFOQVQ6IDcyMCxcbiAgICBBUVRUOiAzMDAsXG4gICAgQVJUOiAtMTgwLFxuICAgIEFTVDogLTI0MCxcbiAgICBBV0RUOiA1NDAsXG4gICAgQVdTVDogNDgwLFxuICAgIEFaT1NUOiAwLFxuICAgIEFaT1Q6IC02MCxcbiAgICBBWlNUOiAzMDAsXG4gICAgQVpUOiAyNDAsXG4gICAgQk5UOiA0ODAsXG4gICAgQk9UOiAtMjQwLFxuICAgIEJSU1Q6IC0xMjAsXG4gICAgQlJUOiAtMTgwLFxuICAgIEJTVDogNjAsXG4gICAgQlRUOiAzNjAsXG4gICAgQ0FTVDogNDgwLFxuICAgIENBVDogMTIwLFxuICAgIENDVDogMzkwLFxuICAgIENEVDogLTMwMCxcbiAgICBDRVNUOiAxMjAsXG4gICAgQ0VUOiB7XG4gICAgICAgIHRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0OiAyICogNjAsXG4gICAgICAgIHRpbWV6b25lT2Zmc2V0Tm9uRHN0OiA2MCxcbiAgICAgICAgZHN0U3RhcnQ6ICh5ZWFyKSA9PiBnZXRMYXN0V2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTUFSQ0gsIFdlZWtkYXkuU1VOREFZLCAyKSxcbiAgICAgICAgZHN0RW5kOiAoeWVhcikgPT4gZ2V0TGFzdFdlZWtkYXlPZk1vbnRoKHllYXIsIE1vbnRoLk9DVE9CRVIsIFdlZWtkYXkuU1VOREFZLCAzKSxcbiAgICB9LFxuICAgIENIQURUOiA4MjUsXG4gICAgQ0hBU1Q6IDc2NSxcbiAgICBDS1Q6IC02MDAsXG4gICAgQ0xTVDogLTE4MCxcbiAgICBDTFQ6IC0yNDAsXG4gICAgQ09UOiAtMzAwLFxuICAgIENTVDogLTM2MCxcbiAgICBDVDoge1xuICAgICAgICB0aW1lem9uZU9mZnNldER1cmluZ0RzdDogLTUgKiA2MCxcbiAgICAgICAgdGltZXpvbmVPZmZzZXROb25Ec3Q6IC02ICogNjAsXG4gICAgICAgIGRzdFN0YXJ0OiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTUFSQ0gsIFdlZWtkYXkuU1VOREFZLCAyLCAyKSxcbiAgICAgICAgZHN0RW5kOiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTk9WRU1CRVIsIFdlZWtkYXkuU1VOREFZLCAxLCAyKSxcbiAgICB9LFxuICAgIENWVDogLTYwLFxuICAgIENYVDogNDIwLFxuICAgIENoU1Q6IDYwMCxcbiAgICBEQVZUOiA0MjAsXG4gICAgRUFTU1Q6IC0zMDAsXG4gICAgRUFTVDogLTM2MCxcbiAgICBFQVQ6IDE4MCxcbiAgICBFQ1Q6IC0zMDAsXG4gICAgRURUOiAtMjQwLFxuICAgIEVFU1Q6IDE4MCxcbiAgICBFRVQ6IDEyMCxcbiAgICBFR1NUOiAwLFxuICAgIEVHVDogLTYwLFxuICAgIEVTVDogLTMwMCxcbiAgICBFVDoge1xuICAgICAgICB0aW1lem9uZU9mZnNldER1cmluZ0RzdDogLTQgKiA2MCxcbiAgICAgICAgdGltZXpvbmVPZmZzZXROb25Ec3Q6IC01ICogNjAsXG4gICAgICAgIGRzdFN0YXJ0OiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTUFSQ0gsIFdlZWtkYXkuU1VOREFZLCAyLCAyKSxcbiAgICAgICAgZHN0RW5kOiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTk9WRU1CRVIsIFdlZWtkYXkuU1VOREFZLCAxLCAyKSxcbiAgICB9LFxuICAgIEZKU1Q6IDc4MCxcbiAgICBGSlQ6IDcyMCxcbiAgICBGS1NUOiAtMTgwLFxuICAgIEZLVDogLTI0MCxcbiAgICBGTlQ6IC0xMjAsXG4gICAgR0FMVDogLTM2MCxcbiAgICBHQU1UOiAtNTQwLFxuICAgIEdFVDogMjQwLFxuICAgIEdGVDogLTE4MCxcbiAgICBHSUxUOiA3MjAsXG4gICAgR01UOiAwLFxuICAgIEdTVDogMjQwLFxuICAgIEdZVDogLTI0MCxcbiAgICBIQUE6IC0xODAsXG4gICAgSEFDOiAtMzAwLFxuICAgIEhBRFQ6IC01NDAsXG4gICAgSEFFOiAtMjQwLFxuICAgIEhBUDogLTQyMCxcbiAgICBIQVI6IC0zNjAsXG4gICAgSEFTVDogLTYwMCxcbiAgICBIQVQ6IC05MCxcbiAgICBIQVk6IC00ODAsXG4gICAgSEtUOiA0ODAsXG4gICAgSExWOiAtMjEwLFxuICAgIEhOQTogLTI0MCxcbiAgICBITkM6IC0zNjAsXG4gICAgSE5FOiAtMzAwLFxuICAgIEhOUDogLTQ4MCxcbiAgICBITlI6IC00MjAsXG4gICAgSE5UOiAtMTUwLFxuICAgIEhOWTogLTU0MCxcbiAgICBIT1ZUOiA0MjAsXG4gICAgSUNUOiA0MjAsXG4gICAgSURUOiAxODAsXG4gICAgSU9UOiAzNjAsXG4gICAgSVJEVDogMjcwLFxuICAgIElSS1NUOiA1NDAsXG4gICAgSVJLVDogNTQwLFxuICAgIElSU1Q6IDIxMCxcbiAgICBJU1Q6IDMzMCxcbiAgICBKU1Q6IDU0MCxcbiAgICBLR1Q6IDM2MCxcbiAgICBLUkFTVDogNDgwLFxuICAgIEtSQVQ6IDQ4MCxcbiAgICBLU1Q6IDU0MCxcbiAgICBLVVlUOiAyNDAsXG4gICAgTEhEVDogNjYwLFxuICAgIExIU1Q6IDYzMCxcbiAgICBMSU5UOiA4NDAsXG4gICAgTUFHU1Q6IDcyMCxcbiAgICBNQUdUOiA3MjAsXG4gICAgTUFSVDogLTUxMCxcbiAgICBNQVdUOiAzMDAsXG4gICAgTURUOiAtMzYwLFxuICAgIE1FU1o6IDEyMCxcbiAgICBNRVo6IDYwLFxuICAgIE1IVDogNzIwLFxuICAgIE1NVDogMzkwLFxuICAgIE1TRDogMjQwLFxuICAgIE1TSzogMTgwLFxuICAgIE1TVDogLTQyMCxcbiAgICBNVDoge1xuICAgICAgICB0aW1lem9uZU9mZnNldER1cmluZ0RzdDogLTYgKiA2MCxcbiAgICAgICAgdGltZXpvbmVPZmZzZXROb25Ec3Q6IC03ICogNjAsXG4gICAgICAgIGRzdFN0YXJ0OiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTUFSQ0gsIFdlZWtkYXkuU1VOREFZLCAyLCAyKSxcbiAgICAgICAgZHN0RW5kOiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTk9WRU1CRVIsIFdlZWtkYXkuU1VOREFZLCAxLCAyKSxcbiAgICB9LFxuICAgIE1VVDogMjQwLFxuICAgIE1WVDogMzAwLFxuICAgIE1ZVDogNDgwLFxuICAgIE5DVDogNjYwLFxuICAgIE5EVDogLTkwLFxuICAgIE5GVDogNjkwLFxuICAgIE5PVlNUOiA0MjAsXG4gICAgTk9WVDogMzYwLFxuICAgIE5QVDogMzQ1LFxuICAgIE5TVDogLTE1MCxcbiAgICBOVVQ6IC02NjAsXG4gICAgTlpEVDogNzgwLFxuICAgIE5aU1Q6IDcyMCxcbiAgICBPTVNTVDogNDIwLFxuICAgIE9NU1Q6IDQyMCxcbiAgICBQRFQ6IC00MjAsXG4gICAgUEVUOiAtMzAwLFxuICAgIFBFVFNUOiA3MjAsXG4gICAgUEVUVDogNzIwLFxuICAgIFBHVDogNjAwLFxuICAgIFBIT1Q6IDc4MCxcbiAgICBQSFQ6IDQ4MCxcbiAgICBQS1Q6IDMwMCxcbiAgICBQTURUOiAtMTIwLFxuICAgIFBNU1Q6IC0xODAsXG4gICAgUE9OVDogNjYwLFxuICAgIFBTVDogLTQ4MCxcbiAgICBQVDoge1xuICAgICAgICB0aW1lem9uZU9mZnNldER1cmluZ0RzdDogLTcgKiA2MCxcbiAgICAgICAgdGltZXpvbmVPZmZzZXROb25Ec3Q6IC04ICogNjAsXG4gICAgICAgIGRzdFN0YXJ0OiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTUFSQ0gsIFdlZWtkYXkuU1VOREFZLCAyLCAyKSxcbiAgICAgICAgZHN0RW5kOiAoeWVhcikgPT4gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgTW9udGguTk9WRU1CRVIsIFdlZWtkYXkuU1VOREFZLCAxLCAyKSxcbiAgICB9LFxuICAgIFBXVDogNTQwLFxuICAgIFBZU1Q6IC0xODAsXG4gICAgUFlUOiAtMjQwLFxuICAgIFJFVDogMjQwLFxuICAgIFNBTVQ6IDI0MCxcbiAgICBTQVNUOiAxMjAsXG4gICAgU0JUOiA2NjAsXG4gICAgU0NUOiAyNDAsXG4gICAgU0dUOiA0ODAsXG4gICAgU1JUOiAtMTgwLFxuICAgIFNTVDogLTY2MCxcbiAgICBUQUhUOiAtNjAwLFxuICAgIFRGVDogMzAwLFxuICAgIFRKVDogMzAwLFxuICAgIFRLVDogNzgwLFxuICAgIFRMVDogNTQwLFxuICAgIFRNVDogMzAwLFxuICAgIFRWVDogNzIwLFxuICAgIFVMQVQ6IDQ4MCxcbiAgICBVVEM6IDAsXG4gICAgVVlTVDogLTEyMCxcbiAgICBVWVQ6IC0xODAsXG4gICAgVVpUOiAzMDAsXG4gICAgVkVUOiAtMjEwLFxuICAgIFZMQVNUOiA2NjAsXG4gICAgVkxBVDogNjYwLFxuICAgIFZVVDogNjYwLFxuICAgIFdBU1Q6IDEyMCxcbiAgICBXQVQ6IDYwLFxuICAgIFdFU1Q6IDYwLFxuICAgIFdFU1o6IDYwLFxuICAgIFdFVDogMCxcbiAgICBXRVo6IDAsXG4gICAgV0ZUOiA3MjAsXG4gICAgV0dTVDogLTEyMCxcbiAgICBXR1Q6IC0xODAsXG4gICAgV0lCOiA0MjAsXG4gICAgV0lUOiA1NDAsXG4gICAgV0lUQTogNDgwLFxuICAgIFdTVDogNzgwLFxuICAgIFdUOiAwLFxuICAgIFlBS1NUOiA2MDAsXG4gICAgWUFLVDogNjAwLFxuICAgIFlBUFQ6IDYwMCxcbiAgICBZRUtTVDogMzYwLFxuICAgIFlFS1Q6IDM2MCxcbn07XG5leHBvcnQgZnVuY3Rpb24gZ2V0TnRoV2Vla2RheU9mTW9udGgoeWVhciwgbW9udGgsIHdlZWtkYXksIG4sIGhvdXIgPSAwKSB7XG4gICAgbGV0IGRheU9mTW9udGggPSAwO1xuICAgIGxldCBpID0gMDtcbiAgICB3aGlsZSAoaSA8IG4pIHtcbiAgICAgICAgZGF5T2ZNb250aCsrO1xuICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoeWVhciwgbW9udGggLSAxLCBkYXlPZk1vbnRoKTtcbiAgICAgICAgaWYgKGRhdGUuZ2V0RGF5KCkgPT09IHdlZWtkYXkpXG4gICAgICAgICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBuZXcgRGF0ZSh5ZWFyLCBtb250aCAtIDEsIGRheU9mTW9udGgsIGhvdXIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldExhc3RXZWVrZGF5T2ZNb250aCh5ZWFyLCBtb250aCwgd2Vla2RheSwgaG91ciA9IDApIHtcbiAgICBjb25zdCBvbmVJbmRleGVkV2Vla2RheSA9IHdlZWtkYXkgPT09IDAgPyA3IDogd2Vla2RheTtcbiAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoeWVhciwgbW9udGggLSAxICsgMSwgMSwgMTIpO1xuICAgIGNvbnN0IGZpcnN0V2Vla2RheU5leHRNb250aCA9IGRhdGUuZ2V0RGF5KCkgPT09IDAgPyA3IDogZGF0ZS5nZXREYXkoKTtcbiAgICBsZXQgZGF5RGlmZjtcbiAgICBpZiAoZmlyc3RXZWVrZGF5TmV4dE1vbnRoID09PSBvbmVJbmRleGVkV2Vla2RheSlcbiAgICAgICAgZGF5RGlmZiA9IDc7XG4gICAgZWxzZSBpZiAoZmlyc3RXZWVrZGF5TmV4dE1vbnRoIDwgb25lSW5kZXhlZFdlZWtkYXkpXG4gICAgICAgIGRheURpZmYgPSA3ICsgZmlyc3RXZWVrZGF5TmV4dE1vbnRoIC0gb25lSW5kZXhlZFdlZWtkYXk7XG4gICAgZWxzZVxuICAgICAgICBkYXlEaWZmID0gZmlyc3RXZWVrZGF5TmV4dE1vbnRoIC0gb25lSW5kZXhlZFdlZWtkYXk7XG4gICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gZGF5RGlmZik7XG4gICAgcmV0dXJuIG5ldyBEYXRlKHllYXIsIG1vbnRoIC0gMSwgZGF0ZS5nZXREYXRlKCksIGhvdXIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRvVGltZXpvbmVPZmZzZXQodGltZXpvbmVJbnB1dCwgZGF0ZSwgdGltZXpvbmVPdmVycmlkZXMgPSB7fSkge1xuICAgIGlmICh0aW1lem9uZUlucHV0ID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgdGltZXpvbmVJbnB1dCA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICByZXR1cm4gdGltZXpvbmVJbnB1dDtcbiAgICB9XG4gICAgY29uc3QgbWF0Y2hlZFRpbWV6b25lID0gdGltZXpvbmVPdmVycmlkZXNbdGltZXpvbmVJbnB1dF0gPz8gVElNRVpPTkVfQUJCUl9NQVBbdGltZXpvbmVJbnB1dF07XG4gICAgaWYgKG1hdGNoZWRUaW1lem9uZSA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIG1hdGNoZWRUaW1lem9uZSA9PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHJldHVybiBtYXRjaGVkVGltZXpvbmU7XG4gICAgfVxuICAgIGlmIChkYXRlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmIChkYXRlID4gbWF0Y2hlZFRpbWV6b25lLmRzdFN0YXJ0KGRhdGUuZ2V0RnVsbFllYXIoKSkgJiYgIShkYXRlID4gbWF0Y2hlZFRpbWV6b25lLmRzdEVuZChkYXRlLmdldEZ1bGxZZWFyKCkpKSkge1xuICAgICAgICByZXR1cm4gbWF0Y2hlZFRpbWV6b25lLnRpbWV6b25lT2Zmc2V0RHVyaW5nRHN0O1xuICAgIH1cbiAgICByZXR1cm4gbWF0Y2hlZFRpbWV6b25lLnRpbWV6b25lT2Zmc2V0Tm9uRHN0O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dGltZXpvbmUuanMubWFwIiwiZXhwb3J0IGNvbnN0IEVtcHR5RHVyYXRpb24gPSB7XG4gICAgZGF5OiAwLFxuICAgIHNlY29uZDogMCxcbiAgICBtaWxsaXNlY29uZDogMCxcbn07XG5leHBvcnQgZnVuY3Rpb24gYWRkRHVyYXRpb24ocmVmLCBkdXJhdGlvbikge1xuICAgIGxldCBkYXRlID0gbmV3IERhdGUocmVmKTtcbiAgICBpZiAoZHVyYXRpb25bXCJ5XCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wieWVhclwiXSA9IGR1cmF0aW9uW1wieVwiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wieVwiXTtcbiAgICB9XG4gICAgaWYgKGR1cmF0aW9uW1wibW9cIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJtb250aFwiXSA9IGR1cmF0aW9uW1wibW9cIl07XG4gICAgICAgIGRlbGV0ZSBkdXJhdGlvbltcIm1vXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJNXCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wibW9udGhcIl0gPSBkdXJhdGlvbltcIk1cIl07XG4gICAgICAgIGRlbGV0ZSBkdXJhdGlvbltcIk1cIl07XG4gICAgfVxuICAgIGlmIChkdXJhdGlvbltcIndcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJ3ZWVrXCJdID0gZHVyYXRpb25bXCJ3XCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJ3XCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJkXCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wiZGF5XCJdID0gZHVyYXRpb25bXCJkXCJdO1xuICAgICAgICBkZWxldGUgZHVyYXRpb25bXCJkXCJdO1xuICAgIH1cbiAgICBpZiAoZHVyYXRpb25bXCJoXCJdKSB7XG4gICAgICAgIGR1cmF0aW9uW1wiaG91clwiXSA9IGR1cmF0aW9uW1wiaFwiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wiaFwiXTtcbiAgICB9XG4gICAgaWYgKGR1cmF0aW9uW1wibVwiXSkge1xuICAgICAgICBkdXJhdGlvbltcIm1pbnV0ZVwiXSA9IGR1cmF0aW9uW1wibVwiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wibVwiXTtcbiAgICB9XG4gICAgaWYgKGR1cmF0aW9uW1wic1wiXSkge1xuICAgICAgICBkdXJhdGlvbltcInNlY29uZFwiXSA9IGR1cmF0aW9uW1wic1wiXTtcbiAgICAgICAgZGVsZXRlIGR1cmF0aW9uW1wic1wiXTtcbiAgICB9XG4gICAgaWYgKGR1cmF0aW9uW1wibXNcIl0pIHtcbiAgICAgICAgZHVyYXRpb25bXCJtaWxsaXNlY29uZFwiXSA9IGR1cmF0aW9uW1wibXNcIl07XG4gICAgICAgIGRlbGV0ZSBkdXJhdGlvbltcIm1zXCJdO1xuICAgIH1cbiAgICBpZiAoXCJ5ZWFyXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wieWVhclwiXSk7XG4gICAgICAgIGRhdGUuc2V0RnVsbFllYXIoZGF0ZS5nZXRGdWxsWWVhcigpICsgZmxvb3IpO1xuICAgICAgICBjb25zdCByZW1haW5pbmdGcmFjdGlvbiA9IGR1cmF0aW9uW1wieWVhclwiXSAtIGZsb29yO1xuICAgICAgICBpZiAocmVtYWluaW5nRnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi5tb250aCA9IGR1cmF0aW9uPy5tb250aCA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24ubW9udGggKz0gcmVtYWluaW5nRnJhY3Rpb24gKiAxMjtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXCJxdWFydGVyXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wicXVhcnRlclwiXSk7XG4gICAgICAgIGRhdGUuc2V0TW9udGgoZGF0ZS5nZXRNb250aCgpICsgZmxvb3IgKiAzKTtcbiAgICB9XG4gICAgaWYgKFwibW9udGhcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJtb250aFwiXSk7XG4gICAgICAgIGRhdGUuc2V0TW9udGgoZGF0ZS5nZXRNb250aCgpICsgZmxvb3IpO1xuICAgICAgICBjb25zdCByZW1haW5pbmdGcmFjdGlvbiA9IGR1cmF0aW9uW1wibW9udGhcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24ud2VlayA9IGR1cmF0aW9uPy53ZWVrID8/IDA7XG4gICAgICAgICAgICBkdXJhdGlvbi53ZWVrICs9IHJlbWFpbmluZ0ZyYWN0aW9uICogNDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXCJ3ZWVrXCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wid2Vla1wiXSk7XG4gICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIGZsb29yICogNyk7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJ3ZWVrXCJdIC0gZmxvb3I7XG4gICAgICAgIGlmIChyZW1haW5pbmdGcmFjdGlvbiA+IDApIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLmRheSA9IGR1cmF0aW9uPy5kYXkgPz8gMDtcbiAgICAgICAgICAgIGR1cmF0aW9uLmRheSArPSBNYXRoLnJvdW5kKHJlbWFpbmluZ0ZyYWN0aW9uICogNyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKFwiZGF5XCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgY29uc3QgZmxvb3IgPSBNYXRoLmZsb29yKGR1cmF0aW9uW1wiZGF5XCJdKTtcbiAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgZmxvb3IpO1xuICAgICAgICBjb25zdCByZW1haW5pbmdGcmFjdGlvbiA9IGR1cmF0aW9uW1wiZGF5XCJdIC0gZmxvb3I7XG4gICAgICAgIGlmIChyZW1haW5pbmdGcmFjdGlvbiA+IDApIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLmhvdXIgPSBkdXJhdGlvbj8uaG91ciA/PyAwO1xuICAgICAgICAgICAgZHVyYXRpb24uaG91ciArPSBNYXRoLnJvdW5kKHJlbWFpbmluZ0ZyYWN0aW9uICogMjQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcImhvdXJcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJob3VyXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRIb3VycyhkYXRlLmdldEhvdXJzKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJob3VyXCJdIC0gZmxvb3I7XG4gICAgICAgIGlmIChyZW1haW5pbmdGcmFjdGlvbiA+IDApIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLm1pbnV0ZSA9IGR1cmF0aW9uPy5taW51dGUgPz8gMDtcbiAgICAgICAgICAgIGR1cmF0aW9uLm1pbnV0ZSArPSBNYXRoLnJvdW5kKHJlbWFpbmluZ0ZyYWN0aW9uICogNjApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChcIm1pbnV0ZVwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcIm1pbnV0ZVwiXSk7XG4gICAgICAgIGRhdGUuc2V0TWludXRlcyhkYXRlLmdldE1pbnV0ZXMoKSArIGZsb29yKTtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nRnJhY3Rpb24gPSBkdXJhdGlvbltcIm1pbnV0ZVwiXSAtIGZsb29yO1xuICAgICAgICBpZiAocmVtYWluaW5nRnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICBkdXJhdGlvbi5zZWNvbmQgPSBkdXJhdGlvbj8uc2Vjb25kID8/IDA7XG4gICAgICAgICAgICBkdXJhdGlvbi5zZWNvbmQgKz0gTWF0aC5yb3VuZChyZW1haW5pbmdGcmFjdGlvbiAqIDYwKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXCJzZWNvbmRcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBmbG9vciA9IE1hdGguZmxvb3IoZHVyYXRpb25bXCJzZWNvbmRcIl0pO1xuICAgICAgICBkYXRlLnNldFNlY29uZHMoZGF0ZS5nZXRTZWNvbmRzKCkgKyBmbG9vcik7XG4gICAgICAgIGNvbnN0IHJlbWFpbmluZ0ZyYWN0aW9uID0gZHVyYXRpb25bXCJzZWNvbmRcIl0gLSBmbG9vcjtcbiAgICAgICAgaWYgKHJlbWFpbmluZ0ZyYWN0aW9uID4gMCkge1xuICAgICAgICAgICAgZHVyYXRpb24ubWlsbGlzZWNvbmQgPSBkdXJhdGlvbj8ubWlsbGlzZWNvbmQgPz8gMDtcbiAgICAgICAgICAgIGR1cmF0aW9uLm1pbGxpc2Vjb25kICs9IE1hdGgucm91bmQocmVtYWluaW5nRnJhY3Rpb24gKiAxMDAwKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoXCJtaWxsaXNlY29uZFwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGZsb29yID0gTWF0aC5mbG9vcihkdXJhdGlvbltcIm1pbGxpc2Vjb25kXCJdKTtcbiAgICAgICAgZGF0ZS5zZXRNaWxsaXNlY29uZHMoZGF0ZS5nZXRNaWxsaXNlY29uZHMoKSArIGZsb29yKTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGU7XG59XG5leHBvcnQgZnVuY3Rpb24gcmV2ZXJzZUR1cmF0aW9uKGR1cmF0aW9uKSB7XG4gICAgY29uc3QgcmV2ZXJzZWQgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiBkdXJhdGlvbikge1xuICAgICAgICByZXZlcnNlZFtrZXldID0gLWR1cmF0aW9uW2tleV07XG4gICAgfVxuICAgIHJldHVybiByZXZlcnNlZDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWR1cmF0aW9uLmpzLm1hcCIsImltcG9ydCB7IGFzc2lnblNpbWlsYXJEYXRlLCBhc3NpZ25TaW1pbGFyVGltZSwgaW1wbHlTaW1pbGFyVGltZSB9IGZyb20gXCIuL3V0aWxzL2RhdGVzLmpzXCI7XG5pbXBvcnQgeyB0b1RpbWV6b25lT2Zmc2V0IH0gZnJvbSBcIi4vdGltZXpvbmUuanNcIjtcbmltcG9ydCB7IGFkZER1cmF0aW9uLCBFbXB0eUR1cmF0aW9uIH0gZnJvbSBcIi4vY2FsY3VsYXRpb24vZHVyYXRpb24uanNcIjtcbmV4cG9ydCBjbGFzcyBSZWZlcmVuY2VXaXRoVGltZXpvbmUge1xuICAgIGluc3RhbnQ7XG4gICAgdGltZXpvbmVPZmZzZXQ7XG4gICAgY29uc3RydWN0b3IoaW5zdGFudCwgdGltZXpvbmVPZmZzZXQpIHtcbiAgICAgICAgdGhpcy5pbnN0YW50ID0gaW5zdGFudCA/PyBuZXcgRGF0ZSgpO1xuICAgICAgICB0aGlzLnRpbWV6b25lT2Zmc2V0ID0gdGltZXpvbmVPZmZzZXQgPz8gbnVsbDtcbiAgICB9XG4gICAgc3RhdGljIGZyb21EYXRlKGRhdGUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWZlcmVuY2VXaXRoVGltZXpvbmUoZGF0ZSk7XG4gICAgfVxuICAgIHN0YXRpYyBmcm9tSW5wdXQoaW5wdXQsIHRpbWV6b25lT3ZlcnJpZGVzKSB7XG4gICAgICAgIGlmIChpbnB1dCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICAgIHJldHVybiBSZWZlcmVuY2VXaXRoVGltZXpvbmUuZnJvbURhdGUoaW5wdXQpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGluc3RhbnQgPSBpbnB1dD8uaW5zdGFudCA/PyBuZXcgRGF0ZSgpO1xuICAgICAgICBjb25zdCB0aW1lem9uZU9mZnNldCA9IHRvVGltZXpvbmVPZmZzZXQoaW5wdXQ/LnRpbWV6b25lLCBpbnN0YW50LCB0aW1lem9uZU92ZXJyaWRlcyk7XG4gICAgICAgIHJldHVybiBuZXcgUmVmZXJlbmNlV2l0aFRpbWV6b25lKGluc3RhbnQsIHRpbWV6b25lT2Zmc2V0KTtcbiAgICB9XG4gICAgZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCkge1xuICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUodGhpcy5pbnN0YW50KTtcbiAgICAgICAgaWYgKHRoaXMudGltZXpvbmVPZmZzZXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGRhdGUuc2V0TWludXRlcyhkYXRlLmdldE1pbnV0ZXMoKSAtIHRoaXMuZ2V0U3lzdGVtVGltZXpvbmVBZGp1c3RtZW50TWludXRlKHRoaXMuaW5zdGFudCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkYXRlO1xuICAgIH1cbiAgICBnZXRTeXN0ZW1UaW1lem9uZUFkanVzdG1lbnRNaW51dGUoZGF0ZSwgb3ZlcnJpZGVUaW1lem9uZU9mZnNldCkge1xuICAgICAgICBpZiAoIWRhdGUpIHtcbiAgICAgICAgICAgIGRhdGUgPSBuZXcgRGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lem9uZU9mZnNldCA9IC1kYXRlLmdldFRpbWV6b25lT2Zmc2V0KCk7XG4gICAgICAgIGNvbnN0IHRhcmdldFRpbWV6b25lT2Zmc2V0ID0gb3ZlcnJpZGVUaW1lem9uZU9mZnNldCA/PyB0aGlzLnRpbWV6b25lT2Zmc2V0ID8/IGN1cnJlbnRUaW1lem9uZU9mZnNldDtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnRUaW1lem9uZU9mZnNldCAtIHRhcmdldFRpbWV6b25lT2Zmc2V0O1xuICAgIH1cbiAgICBnZXRUaW1lem9uZU9mZnNldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGltZXpvbmVPZmZzZXQgPz8gLXRoaXMuaW5zdGFudC5nZXRUaW1lem9uZU9mZnNldCgpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBQYXJzaW5nQ29tcG9uZW50cyB7XG4gICAga25vd25WYWx1ZXM7XG4gICAgaW1wbGllZFZhbHVlcztcbiAgICByZWZlcmVuY2U7XG4gICAgX3RhZ3MgPSBuZXcgU2V0KCk7XG4gICAgY29uc3RydWN0b3IocmVmZXJlbmNlLCBrbm93bkNvbXBvbmVudHMpIHtcbiAgICAgICAgdGhpcy5yZWZlcmVuY2UgPSByZWZlcmVuY2U7XG4gICAgICAgIHRoaXMua25vd25WYWx1ZXMgPSB7fTtcbiAgICAgICAgdGhpcy5pbXBsaWVkVmFsdWVzID0ge307XG4gICAgICAgIGlmIChrbm93bkNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIGtub3duQ29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgIHRoaXMua25vd25WYWx1ZXNba2V5XSA9IGtub3duQ29tcG9uZW50c1trZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgICAgIHRoaXMuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICB0aGlzLmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgIHRoaXMuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIHRoaXMuaW1wbHkoXCJob3VyXCIsIDEyKTtcbiAgICAgICAgdGhpcy5pbXBseShcIm1pbnV0ZVwiLCAwKTtcbiAgICAgICAgdGhpcy5pbXBseShcInNlY29uZFwiLCAwKTtcbiAgICAgICAgdGhpcy5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIH1cbiAgICBzdGF0aWMgY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKHJlZmVyZW5jZSwgZHVyYXRpb24gPSBFbXB0eUR1cmF0aW9uKSB7XG4gICAgICAgIGxldCBkYXRlID0gYWRkRHVyYXRpb24ocmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpLCBkdXJhdGlvbik7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlKTtcbiAgICAgICAgY29tcG9uZW50cy5hZGRUYWcoXCJyZXN1bHQvcmVsYXRpdmVEYXRlXCIpO1xuICAgICAgICBpZiAoXCJob3VyXCIgaW4gZHVyYXRpb24gfHwgXCJtaW51dGVcIiBpbiBkdXJhdGlvbiB8fCBcInNlY29uZFwiIGluIGR1cmF0aW9uIHx8IFwibWlsbGlzZWNvbmRcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICAgICAgY29tcG9uZW50cy5hZGRUYWcoXCJyZXN1bHQvcmVsYXRpdmVEYXRlQW5kVGltZVwiKTtcbiAgICAgICAgICAgIGFzc2lnblNpbWlsYXJUaW1lKGNvbXBvbmVudHMsIGRhdGUpO1xuICAgICAgICAgICAgYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50cywgZGF0ZSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIHJlZmVyZW5jZS5nZXRUaW1lem9uZU9mZnNldCgpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGltcGx5U2ltaWxhclRpbWUoY29tcG9uZW50cywgZGF0ZSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwidGltZXpvbmVPZmZzZXRcIiwgcmVmZXJlbmNlLmdldFRpbWV6b25lT2Zmc2V0KCkpO1xuICAgICAgICAgICAgaWYgKFwiZGF5XCIgaW4gZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIndlZWtkYXlcIiwgZGF0ZS5nZXREYXkoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChcIndlZWtcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJ3ZWVrZGF5XCIsIGRhdGUuZ2V0RGF5KCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICAgICAgaWYgKFwibW9udGhcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFwieWVhclwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgfVxuICAgIGdldChjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudCBpbiB0aGlzLmtub3duVmFsdWVzKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5rbm93blZhbHVlc1tjb21wb25lbnRdO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb21wb25lbnQgaW4gdGhpcy5pbXBsaWVkVmFsdWVzKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsaWVkVmFsdWVzW2NvbXBvbmVudF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlzQ2VydGFpbihjb21wb25lbnQpIHtcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudCBpbiB0aGlzLmtub3duVmFsdWVzO1xuICAgIH1cbiAgICBnZXRDZXJ0YWluQ29tcG9uZW50cygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMua25vd25WYWx1ZXMpO1xuICAgIH1cbiAgICBpbXBseShjb21wb25lbnQsIHZhbHVlKSB7XG4gICAgICAgIGlmIChjb21wb25lbnQgaW4gdGhpcy5rbm93blZhbHVlcykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pbXBsaWVkVmFsdWVzW2NvbXBvbmVudF0gPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGFzc2lnbihjb21wb25lbnQsIHZhbHVlKSB7XG4gICAgICAgIHRoaXMua25vd25WYWx1ZXNbY29tcG9uZW50XSA9IHZhbHVlO1xuICAgICAgICBkZWxldGUgdGhpcy5pbXBsaWVkVmFsdWVzW2NvbXBvbmVudF07XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBhZGREdXJhdGlvbkFzSW1wbGllZChkdXJhdGlvbikge1xuICAgICAgICBjb25zdCBjdXJyZW50RGF0ZSA9IHRoaXMuZGF0ZVdpdGhvdXRUaW1lem9uZUFkanVzdG1lbnQoKTtcbiAgICAgICAgY29uc3QgZGF0ZSA9IGFkZER1cmF0aW9uKGN1cnJlbnREYXRlLCBkdXJhdGlvbik7XG4gICAgICAgIGlmIChcImRheVwiIGluIGR1cmF0aW9uIHx8IFwid2Vla1wiIGluIGR1cmF0aW9uIHx8IFwibW9udGhcIiBpbiBkdXJhdGlvbiB8fCBcInllYXJcIiBpbiBkdXJhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5kZWxldGUoW1wiZGF5XCIsIFwid2Vla2RheVwiLCBcIm1vbnRoXCIsIFwieWVhclwiXSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHRoaXMuaW1wbHkoXCJ3ZWVrZGF5XCIsIGRhdGUuZ2V0RGF5KCkpO1xuICAgICAgICAgICAgdGhpcy5pbXBseShcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgdGhpcy5pbXBseShcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoXCJzZWNvbmRcIiBpbiBkdXJhdGlvbiB8fCBcIm1pbnV0ZVwiIGluIGR1cmF0aW9uIHx8IFwiaG91clwiIGluIGR1cmF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZShbXCJzZWNvbmRcIiwgXCJtaW51dGVcIiwgXCJob3VyXCJdKTtcbiAgICAgICAgICAgIHRoaXMuaW1wbHkoXCJzZWNvbmRcIiwgZGF0ZS5nZXRTZWNvbmRzKCkpO1xuICAgICAgICAgICAgdGhpcy5pbXBseShcIm1pbnV0ZVwiLCBkYXRlLmdldE1pbnV0ZXMoKSk7XG4gICAgICAgICAgICB0aGlzLmltcGx5KFwiaG91clwiLCBkYXRlLmdldEhvdXJzKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBkZWxldGUoY29tcG9uZW50cykge1xuICAgICAgICBpZiAodHlwZW9mIGNvbXBvbmVudHMgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMgPSBbY29tcG9uZW50c107XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBjb21wb25lbnQgb2YgY29tcG9uZW50cykge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMua25vd25WYWx1ZXNbY29tcG9uZW50XTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmltcGxpZWRWYWx1ZXNbY29tcG9uZW50XTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHRoaXMucmVmZXJlbmNlKTtcbiAgICAgICAgY29tcG9uZW50Lmtub3duVmFsdWVzID0ge307XG4gICAgICAgIGNvbXBvbmVudC5pbXBsaWVkVmFsdWVzID0ge307XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMua25vd25WYWx1ZXMpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5rbm93blZhbHVlc1trZXldID0gdGhpcy5rbm93blZhbHVlc1trZXldO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuaW1wbGllZFZhbHVlcykge1xuICAgICAgICAgICAgY29tcG9uZW50LmltcGxpZWRWYWx1ZXNba2V5XSA9IHRoaXMuaW1wbGllZFZhbHVlc1trZXldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuICAgIGlzT25seURhdGUoKSB7XG4gICAgICAgIHJldHVybiAhdGhpcy5pc0NlcnRhaW4oXCJob3VyXCIpICYmICF0aGlzLmlzQ2VydGFpbihcIm1pbnV0ZVwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJzZWNvbmRcIik7XG4gICAgfVxuICAgIGlzT25seVRpbWUoKSB7XG4gICAgICAgIHJldHVybiAoIXRoaXMuaXNDZXJ0YWluKFwid2Vla2RheVwiKSAmJiAhdGhpcy5pc0NlcnRhaW4oXCJkYXlcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwibW9udGhcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwieWVhclwiKSk7XG4gICAgfVxuICAgIGlzT25seVdlZWtkYXlDb21wb25lbnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzQ2VydGFpbihcIndlZWtkYXlcIikgJiYgIXRoaXMuaXNDZXJ0YWluKFwiZGF5XCIpICYmICF0aGlzLmlzQ2VydGFpbihcIm1vbnRoXCIpO1xuICAgIH1cbiAgICBpc0RhdGVXaXRoVW5rbm93blllYXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmlzQ2VydGFpbihcIm1vbnRoXCIpICYmICF0aGlzLmlzQ2VydGFpbihcInllYXJcIik7XG4gICAgfVxuICAgIGlzVmFsaWREYXRlKCkge1xuICAgICAgICBjb25zdCBkYXRlID0gdGhpcy5kYXRlV2l0aG91dFRpbWV6b25lQWRqdXN0bWVudCgpO1xuICAgICAgICBpZiAoZGF0ZS5nZXRGdWxsWWVhcigpICE9PSB0aGlzLmdldChcInllYXJcIikpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChkYXRlLmdldE1vbnRoKCkgIT09IHRoaXMuZ2V0KFwibW9udGhcIikgLSAxKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoZGF0ZS5nZXREYXRlKCkgIT09IHRoaXMuZ2V0KFwiZGF5XCIpKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5nZXQoXCJob3VyXCIpICE9IG51bGwgJiYgZGF0ZS5nZXRIb3VycygpICE9IHRoaXMuZ2V0KFwiaG91clwiKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuZ2V0KFwibWludXRlXCIpICE9IG51bGwgJiYgZGF0ZS5nZXRNaW51dGVzKCkgIT0gdGhpcy5nZXQoXCJtaW51dGVcIikpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIGBbUGFyc2luZ0NvbXBvbmVudHMge1xuICAgICAgICAgICAgdGFnczogJHtKU09OLnN0cmluZ2lmeShBcnJheS5mcm9tKHRoaXMuX3RhZ3MpLnNvcnQoKSl9LCBcbiAgICAgICAgICAgIGtub3duVmFsdWVzOiAke0pTT04uc3RyaW5naWZ5KHRoaXMua25vd25WYWx1ZXMpfSwgXG4gICAgICAgICAgICBpbXBsaWVkVmFsdWVzOiAke0pTT04uc3RyaW5naWZ5KHRoaXMuaW1wbGllZFZhbHVlcyl9fSwgXG4gICAgICAgICAgICByZWZlcmVuY2U6ICR7SlNPTi5zdHJpbmdpZnkodGhpcy5yZWZlcmVuY2UpfV1gO1xuICAgIH1cbiAgICBkYXRlKCkge1xuICAgICAgICBjb25zdCBkYXRlID0gdGhpcy5kYXRlV2l0aG91dFRpbWV6b25lQWRqdXN0bWVudCgpO1xuICAgICAgICBjb25zdCB0aW1lem9uZUFkanVzdG1lbnQgPSB0aGlzLnJlZmVyZW5jZS5nZXRTeXN0ZW1UaW1lem9uZUFkanVzdG1lbnRNaW51dGUoZGF0ZSwgdGhpcy5nZXQoXCJ0aW1lem9uZU9mZnNldFwiKSk7XG4gICAgICAgIHJldHVybiBuZXcgRGF0ZShkYXRlLmdldFRpbWUoKSArIHRpbWV6b25lQWRqdXN0bWVudCAqIDYwMDAwKTtcbiAgICB9XG4gICAgYWRkVGFnKHRhZykge1xuICAgICAgICB0aGlzLl90YWdzLmFkZCh0YWcpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgYWRkVGFncyh0YWdzKSB7XG4gICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MpIHtcbiAgICAgICAgICAgIHRoaXMuX3RhZ3MuYWRkKHRhZyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIHRhZ3MoKSB7XG4gICAgICAgIHJldHVybiBuZXcgU2V0KHRoaXMuX3RhZ3MpO1xuICAgIH1cbiAgICBkYXRlV2l0aG91dFRpbWV6b25lQWRqdXN0bWVudCgpIHtcbiAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHRoaXMuZ2V0KFwieWVhclwiKSwgdGhpcy5nZXQoXCJtb250aFwiKSAtIDEsIHRoaXMuZ2V0KFwiZGF5XCIpLCB0aGlzLmdldChcImhvdXJcIiksIHRoaXMuZ2V0KFwibWludXRlXCIpLCB0aGlzLmdldChcInNlY29uZFwiKSwgdGhpcy5nZXQoXCJtaWxsaXNlY29uZFwiKSk7XG4gICAgICAgIGRhdGUuc2V0RnVsbFllYXIodGhpcy5nZXQoXCJ5ZWFyXCIpKTtcbiAgICAgICAgcmV0dXJuIGRhdGU7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFBhcnNpbmdSZXN1bHQge1xuICAgIHJlZkRhdGU7XG4gICAgaW5kZXg7XG4gICAgdGV4dDtcbiAgICByZWZlcmVuY2U7XG4gICAgc3RhcnQ7XG4gICAgZW5kO1xuICAgIGNvbnN0cnVjdG9yKHJlZmVyZW5jZSwgaW5kZXgsIHRleHQsIHN0YXJ0LCBlbmQpIHtcbiAgICAgICAgdGhpcy5yZWZlcmVuY2UgPSByZWZlcmVuY2U7XG4gICAgICAgIHRoaXMucmVmRGF0ZSA9IHJlZmVyZW5jZS5pbnN0YW50O1xuICAgICAgICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIHRoaXMudGV4dCA9IHRleHQ7XG4gICAgICAgIHRoaXMuc3RhcnQgPSBzdGFydCB8fCBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlKTtcbiAgICAgICAgdGhpcy5lbmQgPSBlbmQ7XG4gICAgfVxuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgUGFyc2luZ1Jlc3VsdCh0aGlzLnJlZmVyZW5jZSwgdGhpcy5pbmRleCwgdGhpcy50ZXh0KTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0ID0gdGhpcy5zdGFydCA/IHRoaXMuc3RhcnQuY2xvbmUoKSA6IG51bGw7XG4gICAgICAgIHJlc3VsdC5lbmQgPSB0aGlzLmVuZCA/IHRoaXMuZW5kLmNsb25lKCkgOiBudWxsO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBkYXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdGFydC5kYXRlKCk7XG4gICAgfVxuICAgIGFkZFRhZyh0YWcpIHtcbiAgICAgICAgdGhpcy5zdGFydC5hZGRUYWcodGFnKTtcbiAgICAgICAgaWYgKHRoaXMuZW5kKSB7XG4gICAgICAgICAgICB0aGlzLmVuZC5hZGRUYWcodGFnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgYWRkVGFncyh0YWdzKSB7XG4gICAgICAgIHRoaXMuc3RhcnQuYWRkVGFncyh0YWdzKTtcbiAgICAgICAgaWYgKHRoaXMuZW5kKSB7XG4gICAgICAgICAgICB0aGlzLmVuZC5hZGRUYWdzKHRhZ3MpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICB0YWdzKCkge1xuICAgICAgICBjb25zdCBjb21iaW5lZFRhZ3MgPSBuZXcgU2V0KHRoaXMuc3RhcnQudGFncygpKTtcbiAgICAgICAgaWYgKHRoaXMuZW5kKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRhZyBvZiB0aGlzLmVuZC50YWdzKCkpIHtcbiAgICAgICAgICAgICAgICBjb21iaW5lZFRhZ3MuYWRkKHRhZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbWJpbmVkVGFncztcbiAgICB9XG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICAgIGNvbnN0IHRhZ3MgPSBBcnJheS5mcm9tKHRoaXMudGFncygpKS5zb3J0KCk7XG4gICAgICAgIHJldHVybiBgW1BhcnNpbmdSZXN1bHQge2luZGV4OiAke3RoaXMuaW5kZXh9LCB0ZXh0OiAnJHt0aGlzLnRleHR9JywgdGFnczogJHtKU09OLnN0cmluZ2lmeSh0YWdzKX0gLi4ufV1gO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJlc3VsdHMuanMubWFwIiwiZXhwb3J0IGZ1bmN0aW9uIHJlcGVhdGVkVGltZXVuaXRQYXR0ZXJuKHByZWZpeCwgc2luZ2xlVGltZXVuaXRQYXR0ZXJuLCBjb25uZWN0b3JQYXR0ZXJuID0gXCJcXFxcc3swLDV9LD9cXFxcc3swLDV9XCIpIHtcbiAgICBjb25zdCBzaW5nbGVUaW1ldW5pdFBhdHRlcm5Ob0NhcHR1cmUgPSBzaW5nbGVUaW1ldW5pdFBhdHRlcm4ucmVwbGFjZSgvXFwoKD8hXFw/KS9nLCBcIig/OlwiKTtcbiAgICByZXR1cm4gYCR7cHJlZml4fSR7c2luZ2xlVGltZXVuaXRQYXR0ZXJuTm9DYXB0dXJlfSg/OiR7Y29ubmVjdG9yUGF0dGVybn0ke3NpbmdsZVRpbWV1bml0UGF0dGVybk5vQ2FwdHVyZX0pezAsMTB9YDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0VGVybXMoZGljdGlvbmFyeSkge1xuICAgIGxldCBrZXlzO1xuICAgIGlmIChkaWN0aW9uYXJ5IGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAga2V5cyA9IFsuLi5kaWN0aW9uYXJ5XTtcbiAgICB9XG4gICAgZWxzZSBpZiAoZGljdGlvbmFyeSBpbnN0YW5jZW9mIE1hcCkge1xuICAgICAgICBrZXlzID0gQXJyYXkuZnJvbShkaWN0aW9uYXJ5LmtleXMoKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBrZXlzID0gT2JqZWN0LmtleXMoZGljdGlvbmFyeSk7XG4gICAgfVxuICAgIHJldHVybiBrZXlzO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoQW55UGF0dGVybihkaWN0aW9uYXJ5KSB7XG4gICAgY29uc3Qgam9pbmVkVGVybXMgPSBleHRyYWN0VGVybXMoZGljdGlvbmFyeSlcbiAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIubGVuZ3RoIC0gYS5sZW5ndGgpXG4gICAgICAgIC5qb2luKFwifFwiKVxuICAgICAgICAucmVwbGFjZSgvXFwuL2csIFwiXFxcXC5cIik7XG4gICAgcmV0dXJuIGAoPzoke2pvaW5lZFRlcm1zfSlgO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGF0dGVybi5qcy5tYXAiLCJpbXBvcnQgeyBhZGREdXJhdGlvbiB9IGZyb20gXCIuL2R1cmF0aW9uLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gZmluZE1vc3RMaWtlbHlBRFllYXIoeWVhck51bWJlcikge1xuICAgIGlmICh5ZWFyTnVtYmVyIDwgMTAwKSB7XG4gICAgICAgIGlmICh5ZWFyTnVtYmVyID4gNTApIHtcbiAgICAgICAgICAgIHllYXJOdW1iZXIgPSB5ZWFyTnVtYmVyICsgMTkwMDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHllYXJOdW1iZXIgPSB5ZWFyTnVtYmVyICsgMjAwMDtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geWVhck51bWJlcjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBmaW5kWWVhckNsb3Nlc3RUb1JlZihyZWZEYXRlLCBkYXksIG1vbnRoKSB7XG4gICAgbGV0IGRhdGUgPSBuZXcgRGF0ZShyZWZEYXRlKTtcbiAgICBkYXRlLnNldE1vbnRoKG1vbnRoIC0gMSk7XG4gICAgZGF0ZS5zZXREYXRlKGRheSk7XG4gICAgY29uc3QgbmV4dFllYXIgPSBhZGREdXJhdGlvbihkYXRlLCB7IFwieWVhclwiOiAxIH0pO1xuICAgIGNvbnN0IGxhc3RZZWFyID0gYWRkRHVyYXRpb24oZGF0ZSwgeyBcInllYXJcIjogLTEgfSk7XG4gICAgaWYgKE1hdGguYWJzKG5leHRZZWFyLmdldFRpbWUoKSAtIHJlZkRhdGUuZ2V0VGltZSgpKSA8IE1hdGguYWJzKGRhdGUuZ2V0VGltZSgpIC0gcmVmRGF0ZS5nZXRUaW1lKCkpKSB7XG4gICAgICAgIGRhdGUgPSBuZXh0WWVhcjtcbiAgICB9XG4gICAgZWxzZSBpZiAoTWF0aC5hYnMobGFzdFllYXIuZ2V0VGltZSgpIC0gcmVmRGF0ZS5nZXRUaW1lKCkpIDwgTWF0aC5hYnMoZGF0ZS5nZXRUaW1lKCkgLSByZWZEYXRlLmdldFRpbWUoKSkpIHtcbiAgICAgICAgZGF0ZSA9IGxhc3RZZWFyO1xuICAgIH1cbiAgICByZXR1cm4gZGF0ZS5nZXRGdWxsWWVhcigpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9eWVhcnMuanMubWFwIiwiaW1wb3J0IHsgbWF0Y2hBbnlQYXR0ZXJuLCByZXBlYXRlZFRpbWV1bml0UGF0dGVybiB9IGZyb20gXCIuLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5pbXBvcnQgeyBmaW5kTW9zdExpa2VseUFEWWVhciB9IGZyb20gXCIuLi8uLi9jYWxjdWxhdGlvbi95ZWFycy5qc1wiO1xuZXhwb3J0IGNvbnN0IFdFRUtEQVlfRElDVElPTkFSWSA9IHtcbiAgICBzdW5kYXk6IDAsXG4gICAgc3VuOiAwLFxuICAgIFwic3VuLlwiOiAwLFxuICAgIG1vbmRheTogMSxcbiAgICBtb246IDEsXG4gICAgXCJtb24uXCI6IDEsXG4gICAgdHVlc2RheTogMixcbiAgICB0dWU6IDIsXG4gICAgXCJ0dWUuXCI6IDIsXG4gICAgd2VkbmVzZGF5OiAzLFxuICAgIHdlZDogMyxcbiAgICBcIndlZC5cIjogMyxcbiAgICB0aHVyc2RheTogNCxcbiAgICB0aHVyczogNCxcbiAgICBcInRodXJzLlwiOiA0LFxuICAgIHRodXI6IDQsXG4gICAgXCJ0aHVyLlwiOiA0LFxuICAgIHRodTogNCxcbiAgICBcInRodS5cIjogNCxcbiAgICBmcmlkYXk6IDUsXG4gICAgZnJpOiA1LFxuICAgIFwiZnJpLlwiOiA1LFxuICAgIHNhdHVyZGF5OiA2LFxuICAgIHNhdDogNixcbiAgICBcInNhdC5cIjogNixcbn07XG5leHBvcnQgY29uc3QgRlVMTF9NT05USF9OQU1FX0RJQ1RJT05BUlkgPSB7XG4gICAgamFudWFyeTogMSxcbiAgICBmZWJydWFyeTogMixcbiAgICBtYXJjaDogMyxcbiAgICBhcHJpbDogNCxcbiAgICBtYXk6IDUsXG4gICAganVuZTogNixcbiAgICBqdWx5OiA3LFxuICAgIGF1Z3VzdDogOCxcbiAgICBzZXB0ZW1iZXI6IDksXG4gICAgb2N0b2JlcjogMTAsXG4gICAgbm92ZW1iZXI6IDExLFxuICAgIGRlY2VtYmVyOiAxMixcbn07XG5leHBvcnQgY29uc3QgTU9OVEhfRElDVElPTkFSWSA9IHtcbiAgICAuLi5GVUxMX01PTlRIX05BTUVfRElDVElPTkFSWSxcbiAgICBqYW46IDEsXG4gICAgXCJqYW4uXCI6IDEsXG4gICAgZmViOiAyLFxuICAgIFwiZmViLlwiOiAyLFxuICAgIG1hcjogMyxcbiAgICBcIm1hci5cIjogMyxcbiAgICBhcHI6IDQsXG4gICAgXCJhcHIuXCI6IDQsXG4gICAganVuOiA2LFxuICAgIFwianVuLlwiOiA2LFxuICAgIGp1bDogNyxcbiAgICBcImp1bC5cIjogNyxcbiAgICBhdWc6IDgsXG4gICAgXCJhdWcuXCI6IDgsXG4gICAgc2VwOiA5LFxuICAgIFwic2VwLlwiOiA5LFxuICAgIHNlcHQ6IDksXG4gICAgXCJzZXB0LlwiOiA5LFxuICAgIG9jdDogMTAsXG4gICAgXCJvY3QuXCI6IDEwLFxuICAgIG5vdjogMTEsXG4gICAgXCJub3YuXCI6IDExLFxuICAgIGRlYzogMTIsXG4gICAgXCJkZWMuXCI6IDEyLFxufTtcbmV4cG9ydCBjb25zdCBJTlRFR0VSX1dPUkRfRElDVElPTkFSWSA9IHtcbiAgICBvbmU6IDEsXG4gICAgdHdvOiAyLFxuICAgIHRocmVlOiAzLFxuICAgIGZvdXI6IDQsXG4gICAgZml2ZTogNSxcbiAgICBzaXg6IDYsXG4gICAgc2V2ZW46IDcsXG4gICAgZWlnaHQ6IDgsXG4gICAgbmluZTogOSxcbiAgICB0ZW46IDEwLFxuICAgIGVsZXZlbjogMTEsXG4gICAgdHdlbHZlOiAxMixcbn07XG5leHBvcnQgY29uc3QgT1JESU5BTF9XT1JEX0RJQ1RJT05BUlkgPSB7XG4gICAgZmlyc3Q6IDEsXG4gICAgc2Vjb25kOiAyLFxuICAgIHRoaXJkOiAzLFxuICAgIGZvdXJ0aDogNCxcbiAgICBmaWZ0aDogNSxcbiAgICBzaXh0aDogNixcbiAgICBzZXZlbnRoOiA3LFxuICAgIGVpZ2h0aDogOCxcbiAgICBuaW50aDogOSxcbiAgICB0ZW50aDogMTAsXG4gICAgZWxldmVudGg6IDExLFxuICAgIHR3ZWxmdGg6IDEyLFxuICAgIHRoaXJ0ZWVudGg6IDEzLFxuICAgIGZvdXJ0ZWVudGg6IDE0LFxuICAgIGZpZnRlZW50aDogMTUsXG4gICAgc2l4dGVlbnRoOiAxNixcbiAgICBzZXZlbnRlZW50aDogMTcsXG4gICAgZWlnaHRlZW50aDogMTgsXG4gICAgbmluZXRlZW50aDogMTksXG4gICAgdHdlbnRpZXRoOiAyMCxcbiAgICBcInR3ZW50eSBmaXJzdFwiOiAyMSxcbiAgICBcInR3ZW50eS1maXJzdFwiOiAyMSxcbiAgICBcInR3ZW50eSBzZWNvbmRcIjogMjIsXG4gICAgXCJ0d2VudHktc2Vjb25kXCI6IDIyLFxuICAgIFwidHdlbnR5IHRoaXJkXCI6IDIzLFxuICAgIFwidHdlbnR5LXRoaXJkXCI6IDIzLFxuICAgIFwidHdlbnR5IGZvdXJ0aFwiOiAyNCxcbiAgICBcInR3ZW50eS1mb3VydGhcIjogMjQsXG4gICAgXCJ0d2VudHkgZmlmdGhcIjogMjUsXG4gICAgXCJ0d2VudHktZmlmdGhcIjogMjUsXG4gICAgXCJ0d2VudHkgc2l4dGhcIjogMjYsXG4gICAgXCJ0d2VudHktc2l4dGhcIjogMjYsXG4gICAgXCJ0d2VudHkgc2V2ZW50aFwiOiAyNyxcbiAgICBcInR3ZW50eS1zZXZlbnRoXCI6IDI3LFxuICAgIFwidHdlbnR5IGVpZ2h0aFwiOiAyOCxcbiAgICBcInR3ZW50eS1laWdodGhcIjogMjgsXG4gICAgXCJ0d2VudHkgbmludGhcIjogMjksXG4gICAgXCJ0d2VudHktbmludGhcIjogMjksXG4gICAgXCJ0aGlydGlldGhcIjogMzAsXG4gICAgXCJ0aGlydHkgZmlyc3RcIjogMzEsXG4gICAgXCJ0aGlydHktZmlyc3RcIjogMzEsXG59O1xuZXhwb3J0IGNvbnN0IFRJTUVfVU5JVF9ESUNUSU9OQVJZX05PX0FCQlIgPSB7XG4gICAgc2Vjb25kOiBcInNlY29uZFwiLFxuICAgIHNlY29uZHM6IFwic2Vjb25kXCIsXG4gICAgbWludXRlOiBcIm1pbnV0ZVwiLFxuICAgIG1pbnV0ZXM6IFwibWludXRlXCIsXG4gICAgaG91cjogXCJob3VyXCIsXG4gICAgaG91cnM6IFwiaG91clwiLFxuICAgIGRheTogXCJkYXlcIixcbiAgICBkYXlzOiBcImRheVwiLFxuICAgIHdlZWs6IFwid2Vla1wiLFxuICAgIHdlZWtzOiBcIndlZWtcIixcbiAgICBtb250aDogXCJtb250aFwiLFxuICAgIG1vbnRoczogXCJtb250aFwiLFxuICAgIHF1YXJ0ZXI6IFwicXVhcnRlclwiLFxuICAgIHF1YXJ0ZXJzOiBcInF1YXJ0ZXJcIixcbiAgICB5ZWFyOiBcInllYXJcIixcbiAgICB5ZWFyczogXCJ5ZWFyXCIsXG59O1xuZXhwb3J0IGNvbnN0IFRJTUVfVU5JVF9ESUNUSU9OQVJZID0ge1xuICAgIHM6IFwic2Vjb25kXCIsXG4gICAgc2VjOiBcInNlY29uZFwiLFxuICAgIHNlY29uZDogXCJzZWNvbmRcIixcbiAgICBzZWNvbmRzOiBcInNlY29uZFwiLFxuICAgIG06IFwibWludXRlXCIsXG4gICAgbWluOiBcIm1pbnV0ZVwiLFxuICAgIG1pbnM6IFwibWludXRlXCIsXG4gICAgbWludXRlOiBcIm1pbnV0ZVwiLFxuICAgIG1pbnV0ZXM6IFwibWludXRlXCIsXG4gICAgaDogXCJob3VyXCIsXG4gICAgaHI6IFwiaG91clwiLFxuICAgIGhyczogXCJob3VyXCIsXG4gICAgaG91cjogXCJob3VyXCIsXG4gICAgaG91cnM6IFwiaG91clwiLFxuICAgIGQ6IFwiZGF5XCIsXG4gICAgZGF5OiBcImRheVwiLFxuICAgIGRheXM6IFwiZGF5XCIsXG4gICAgdzogXCJ3ZWVrXCIsXG4gICAgd2VlazogXCJ3ZWVrXCIsXG4gICAgd2Vla3M6IFwid2Vla1wiLFxuICAgIG1vOiBcIm1vbnRoXCIsXG4gICAgbW9uOiBcIm1vbnRoXCIsXG4gICAgbW9zOiBcIm1vbnRoXCIsXG4gICAgbW9udGg6IFwibW9udGhcIixcbiAgICBtb250aHM6IFwibW9udGhcIixcbiAgICBxdHI6IFwicXVhcnRlclwiLFxuICAgIHF1YXJ0ZXI6IFwicXVhcnRlclwiLFxuICAgIHF1YXJ0ZXJzOiBcInF1YXJ0ZXJcIixcbiAgICB5OiBcInllYXJcIixcbiAgICB5cjogXCJ5ZWFyXCIsXG4gICAgeWVhcjogXCJ5ZWFyXCIsXG4gICAgeWVhcnM6IFwieWVhclwiLFxuICAgIC4uLlRJTUVfVU5JVF9ESUNUSU9OQVJZX05PX0FCQlIsXG59O1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9QQVRURVJOID0gYCg/OiR7bWF0Y2hBbnlQYXR0ZXJuKElOVEVHRVJfV09SRF9ESUNUSU9OQVJZKX18WzAtOV0rfFswLTldK1xcXFwuWzAtOV0rfGhhbGYoPzpcXFxcc3swLDJ9YW4/KT98YW4/XFxcXGIoPzpcXFxcc3swLDJ9ZmV3KT98ZmV3fHNldmVyYWx8dGhlfGE/XFxcXHN7MCwyfWNvdXBsZVxcXFxzezAsMn0oPzpvZik/KWA7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VOdW1iZXJQYXR0ZXJuKG1hdGNoKSB7XG4gICAgY29uc3QgbnVtID0gbWF0Y2gudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAoSU5URUdFUl9XT1JEX0RJQ1RJT05BUllbbnVtXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBJTlRFR0VSX1dPUkRfRElDVElPTkFSWVtudW1dO1xuICAgIH1cbiAgICBlbHNlIGlmIChudW0gPT09IFwiYVwiIHx8IG51bSA9PT0gXCJhblwiIHx8IG51bSA9PSBcInRoZVwiKSB7XG4gICAgICAgIHJldHVybiAxO1xuICAgIH1cbiAgICBlbHNlIGlmIChudW0ubWF0Y2goL2Zldy8pKSB7XG4gICAgICAgIHJldHVybiAzO1xuICAgIH1cbiAgICBlbHNlIGlmIChudW0ubWF0Y2goL2hhbGYvKSkge1xuICAgICAgICByZXR1cm4gMC41O1xuICAgIH1cbiAgICBlbHNlIGlmIChudW0ubWF0Y2goL2NvdXBsZS8pKSB7XG4gICAgICAgIHJldHVybiAyO1xuICAgIH1cbiAgICBlbHNlIGlmIChudW0ubWF0Y2goL3NldmVyYWwvKSkge1xuICAgICAgICByZXR1cm4gNztcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlRmxvYXQobnVtKTtcbn1cbmV4cG9ydCBjb25zdCBPUkRJTkFMX05VTUJFUl9QQVRURVJOID0gYCg/OiR7bWF0Y2hBbnlQYXR0ZXJuKE9SRElOQUxfV09SRF9ESUNUSU9OQVJZKX18WzAtOV17MSwyfSg/OnN0fG5kfHJkfHRoKT8pYDtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU9yZGluYWxOdW1iZXJQYXR0ZXJuKG1hdGNoKSB7XG4gICAgbGV0IG51bSA9IG1hdGNoLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKE9SRElOQUxfV09SRF9ESUNUSU9OQVJZW251bV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gT1JESU5BTF9XT1JEX0RJQ1RJT05BUllbbnVtXTtcbiAgICB9XG4gICAgbnVtID0gbnVtLnJlcGxhY2UoLyg/OnN0fG5kfHJkfHRoKSQvaSwgXCJcIik7XG4gICAgcmV0dXJuIHBhcnNlSW50KG51bSk7XG59XG5leHBvcnQgY29uc3QgWUVBUl9QQVRURVJOID0gYCg/OlsxLTldWzAtOV17MCwzfVxcXFxzezAsMn0oPzpCRXxBRHxCQ3xCQ0V8Q0UpfFsxLTldWzAtOV17M318WzUtOV1bMC05XXwyWzAtNV0pYDtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVllYXIobWF0Y2gpIHtcbiAgICBpZiAoL0JFL2kudGVzdChtYXRjaCkpIHtcbiAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKC9CRS9pLCBcIlwiKTtcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KG1hdGNoKSAtIDU0MztcbiAgICB9XG4gICAgaWYgKC9CQ0U/L2kudGVzdChtYXRjaCkpIHtcbiAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKC9CQ0U/L2ksIFwiXCIpO1xuICAgICAgICByZXR1cm4gLXBhcnNlSW50KG1hdGNoKTtcbiAgICB9XG4gICAgaWYgKC8oQUR8Q0UpL2kudGVzdChtYXRjaCkpIHtcbiAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKC8oQUR8Q0UpL2ksIFwiXCIpO1xuICAgICAgICByZXR1cm4gcGFyc2VJbnQobWF0Y2gpO1xuICAgIH1cbiAgICBjb25zdCByYXdZZWFyTnVtYmVyID0gcGFyc2VJbnQobWF0Y2gpO1xuICAgIHJldHVybiBmaW5kTW9zdExpa2VseUFEWWVhcihyYXdZZWFyTnVtYmVyKTtcbn1cbmNvbnN0IFNJTkdMRV9USU1FX1VOSVRfUEFUVEVSTiA9IGAoJHtOVU1CRVJfUEFUVEVSTn0pXFxcXHN7MCwzfSgke21hdGNoQW55UGF0dGVybihUSU1FX1VOSVRfRElDVElPTkFSWSl9KWA7XG5jb25zdCBTSU5HTEVfVElNRV9VTklUX1JFR0VYID0gbmV3IFJlZ0V4cChTSU5HTEVfVElNRV9VTklUX1BBVFRFUk4sIFwiaVwiKTtcbmNvbnN0IFNJTkdMRV9USU1FX1VOSVRfTk9fQUJCUl9QQVRURVJOID0gYCgke05VTUJFUl9QQVRURVJOfSlcXFxcc3swLDN9KCR7bWF0Y2hBbnlQYXR0ZXJuKFRJTUVfVU5JVF9ESUNUSU9OQVJZX05PX0FCQlIpfSlgO1xuY29uc3QgVElNRV9VTklUX0NPTk5FQ1RPUl9QQVRURVJOID0gYFxcXFxzezAsNX0sPyg/OlxcXFxzKmFuZCk/XFxcXHN7MCw1fWA7XG5leHBvcnQgY29uc3QgVElNRV9VTklUU19QQVRURVJOID0gcmVwZWF0ZWRUaW1ldW5pdFBhdHRlcm4oYCg/Oig/OmFib3V0fGFyb3VuZClcXFxcc3swLDN9KT9gLCBTSU5HTEVfVElNRV9VTklUX1BBVFRFUk4sIFRJTUVfVU5JVF9DT05ORUNUT1JfUEFUVEVSTik7XG5leHBvcnQgY29uc3QgVElNRV9VTklUU19OT19BQkJSX1BBVFRFUk4gPSByZXBlYXRlZFRpbWV1bml0UGF0dGVybihgKD86KD86YWJvdXR8YXJvdW5kKVxcXFxzezAsM30pP2AsIFNJTkdMRV9USU1FX1VOSVRfTk9fQUJCUl9QQVRURVJOLCBUSU1FX1VOSVRfQ09OTkVDVE9SX1BBVFRFUk4pO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRHVyYXRpb24odGltZXVuaXRUZXh0KSB7XG4gICAgY29uc3QgZnJhZ21lbnRzID0ge307XG4gICAgbGV0IHJlbWFpbmluZ1RleHQgPSB0aW1ldW5pdFRleHQ7XG4gICAgbGV0IG1hdGNoID0gU0lOR0xFX1RJTUVfVU5JVF9SRUdFWC5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgIHdoaWxlIChtYXRjaCkge1xuICAgICAgICBjb2xsZWN0RGF0ZVRpbWVGcmFnbWVudChmcmFnbWVudHMsIG1hdGNoKTtcbiAgICAgICAgcmVtYWluaW5nVGV4dCA9IHJlbWFpbmluZ1RleHQuc3Vic3RyaW5nKG1hdGNoWzBdLmxlbmd0aCkudHJpbSgpO1xuICAgICAgICBtYXRjaCA9IFNJTkdMRV9USU1FX1VOSVRfUkVHRVguZXhlYyhyZW1haW5pbmdUZXh0KTtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5rZXlzKGZyYWdtZW50cykubGVuZ3RoID09IDApIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBmcmFnbWVudHM7XG59XG5mdW5jdGlvbiBjb2xsZWN0RGF0ZVRpbWVGcmFnbWVudChmcmFnbWVudHMsIG1hdGNoKSB7XG4gICAgaWYgKG1hdGNoWzBdLm1hdGNoKC9eW2EtekEtWl0rJC8pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbnVtID0gcGFyc2VOdW1iZXJQYXR0ZXJuKG1hdGNoWzFdKTtcbiAgICBjb25zdCB1bml0ID0gVElNRV9VTklUX0RJQ1RJT05BUllbbWF0Y2hbMl0udG9Mb3dlckNhc2UoKV07XG4gICAgZnJhZ21lbnRzW3VuaXRdID0gbnVtO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29uc3RhbnRzLmpzLm1hcCIsImV4cG9ydCBjbGFzcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuSGFzQ2hhbmdlKGNvbnRleHQsIGN1cnJlbnRJbm5lclBhdHRlcm4pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5uZXJQYXR0ZXJuKGNvbnRleHQpICE9PSBjdXJyZW50SW5uZXJQYXR0ZXJuO1xuICAgIH1cbiAgICBwYXR0ZXJuTGVmdEJvdW5kYXJ5KCkge1xuICAgICAgICByZXR1cm4gYChcXFxcV3xeKWA7XG4gICAgfVxuICAgIGNhY2hlZElubmVyUGF0dGVybiA9IG51bGw7XG4gICAgY2FjaGVkUGF0dGVybiA9IG51bGw7XG4gICAgcGF0dGVybihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLmNhY2hlZElubmVyUGF0dGVybikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmlubmVyUGF0dGVybkhhc0NoYW5nZShjb250ZXh0LCB0aGlzLmNhY2hlZElubmVyUGF0dGVybikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jYWNoZWRQYXR0ZXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2FjaGVkSW5uZXJQYXR0ZXJuID0gdGhpcy5pbm5lclBhdHRlcm4oY29udGV4dCk7XG4gICAgICAgIHRoaXMuY2FjaGVkUGF0dGVybiA9IG5ldyBSZWdFeHAoYCR7dGhpcy5wYXR0ZXJuTGVmdEJvdW5kYXJ5KCl9JHt0aGlzLmNhY2hlZElubmVyUGF0dGVybi5zb3VyY2V9YCwgdGhpcy5jYWNoZWRJbm5lclBhdHRlcm4uZmxhZ3MpO1xuICAgICAgICByZXR1cm4gdGhpcy5jYWNoZWRQYXR0ZXJuO1xuICAgIH1cbiAgICBleHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGhlYWRlciA9IG1hdGNoWzFdID8/IFwiXCI7XG4gICAgICAgIG1hdGNoLmluZGV4ID0gbWF0Y2guaW5kZXggKyBoZWFkZXIubGVuZ3RoO1xuICAgICAgICBtYXRjaFswXSA9IG1hdGNoWzBdLnN1YnN0cmluZyhoZWFkZXIubGVuZ3RoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDI7IGkgPCBtYXRjaC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWF0Y2hbaSAtIDFdID0gbWF0Y2hbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanMubWFwIiwiaW1wb3J0IHsgVElNRV9VTklUU19QQVRURVJOLCBwYXJzZUR1cmF0aW9uLCBUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTiB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IFBhcnNpbmdDb21wb25lbnRzIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTl9XSVRIX09QVElPTkFMX1BSRUZJWCA9IG5ldyBSZWdFeHAoYCg/Oig/OndpdGhpbnxpbnxmb3IpXFxcXHMqKT9gICtcbiAgICBgKD86KD86YWJvdXR8YXJvdW5kfHJvdWdobHl8YXBwcm94aW1hdGVseXxqdXN0KVxcXFxzKig/On5cXFxccyopPyk/KCR7VElNRV9VTklUU19QQVRURVJOfSkoPz1cXFxcV3wkKWAsIFwiaVwiKTtcbmNvbnN0IFBBVFRFUk5fV0lUSF9QUkVGSVggPSBuZXcgUmVnRXhwKGAoPzp3aXRoaW58aW58Zm9yKVxcXFxzKmAgK1xuICAgIGAoPzooPzphYm91dHxhcm91bmR8cm91Z2hseXxhcHByb3hpbWF0ZWx5fGp1c3QpXFxcXHMqKD86flxcXFxzKik/KT8oJHtUSU1FX1VOSVRTX1BBVFRFUk59KSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgUEFUVEVSTl9XSVRIX1BSRUZJWF9TVFJJQ1QgPSBuZXcgUmVnRXhwKGAoPzp3aXRoaW58aW58Zm9yKVxcXFxzKmAgK1xuICAgIGAoPzooPzphYm91dHxhcm91bmR8cm91Z2hseXxhcHByb3hpbWF0ZWx5fGp1c3QpXFxcXHMqKD86flxcXFxzKik/KT8oJHtUSU1FX1VOSVRTX05PX0FCQlJfUEFUVEVSTn0pKD89XFxcXFd8JClgLCBcImlcIik7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlRpbWVVbml0V2l0aGluRm9ybWF0UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIHN0cmljdE1vZGU7XG4gICAgY29uc3RydWN0b3Ioc3RyaWN0TW9kZSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnN0cmljdE1vZGUgPSBzdHJpY3RNb2RlO1xuICAgIH1cbiAgICBpbm5lclBhdHRlcm4oY29udGV4dCkge1xuICAgICAgICBpZiAodGhpcy5zdHJpY3RNb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gUEFUVEVSTl9XSVRIX1BSRUZJWF9TVFJJQ1Q7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbnRleHQub3B0aW9uLmZvcndhcmREYXRlID8gUEFUVEVSTl9XSVRIX09QVElPTkFMX1BSRUZJWCA6IFBBVFRFUk5fV0lUSF9QUkVGSVg7XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBpZiAobWF0Y2hbMF0ubWF0Y2goL15mb3JcXHMqdGhlXFxzKlxcdysvKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGltZVVuaXRzID0gcGFyc2VEdXJhdGlvbihtYXRjaFsxXSk7XG4gICAgICAgIGlmICghdGltZVVuaXRzKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCB0aW1lVW5pdHMpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZVVuaXRXaXRoaW5Gb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgZmluZFllYXJDbG9zZXN0VG9SZWYgfSBmcm9tIFwiLi4vLi4vLi4vY2FsY3VsYXRpb24veWVhcnMuanNcIjtcbmltcG9ydCB7IE1PTlRIX0RJQ1RJT05BUlkgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBZRUFSX1BBVFRFUk4sIHBhcnNlWWVhciB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IE9SRElOQUxfTlVNQkVSX1BBVFRFUk4sIHBhcnNlT3JkaW5hbE51bWJlclBhdHRlcm4gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBtYXRjaEFueVBhdHRlcm4gfSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvcGF0dGVybi5qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKD86b25cXFxcc3swLDN9KT9gICtcbiAgICBgKCR7T1JESU5BTF9OVU1CRVJfUEFUVEVSTn0pYCArXG4gICAgYCg/OmAgK1xuICAgIGBcXFxcc3swLDN9KD86dG98XFxcXC18XFxcXOKAk3x1bnRpbHx0aHJvdWdofHRpbGwpP1xcXFxzezAsM31gICtcbiAgICBgKCR7T1JESU5BTF9OVU1CRVJfUEFUVEVSTn0pYCArXG4gICAgXCIpP1wiICtcbiAgICBgKD86LXwvfFxcXFxzezAsM30oPzpvZik/XFxcXHN7MCwzfSlgICtcbiAgICBgKCR7bWF0Y2hBbnlQYXR0ZXJuKE1PTlRIX0RJQ1RJT05BUlkpfSlgICtcbiAgICBcIig/OlwiICtcbiAgICBgKD86LXwvfCw/XFxcXHN7MCwzfSlgICtcbiAgICBgKCR7WUVBUl9QQVRURVJOfSg/IVxcXFx3KSlgICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD89XFxcXFd8JClcIiwgXCJpXCIpO1xuY29uc3QgREFURV9HUk9VUCA9IDE7XG5jb25zdCBEQVRFX1RPX0dST1VQID0gMjtcbmNvbnN0IE1PTlRIX05BTUVfR1JPVVAgPSAzO1xuY29uc3QgWUVBUl9HUk9VUCA9IDQ7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTk1vbnRoTmFtZUxpdHRsZUVuZGlhblBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gTU9OVEhfRElDVElPTkFSWVttYXRjaFtNT05USF9OQU1FX0dST1VQXS50b0xvd2VyQ2FzZSgpXTtcbiAgICAgICAgY29uc3QgZGF5ID0gcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybihtYXRjaFtEQVRFX0dST1VQXSk7XG4gICAgICAgIGlmIChkYXkgPiAzMSkge1xuICAgICAgICAgICAgbWF0Y2guaW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoW0RBVEVfR1JPVVBdLmxlbmd0aDtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBtb250aCk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgZGF5KTtcbiAgICAgICAgaWYgKG1hdGNoW1lFQVJfR1JPVVBdKSB7XG4gICAgICAgICAgICBjb25zdCB5ZWFyTnVtYmVyID0gcGFyc2VZZWFyKG1hdGNoW1lFQVJfR1JPVVBdKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIHllYXJOdW1iZXIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgeWVhciA9IGZpbmRZZWFyQ2xvc2VzdFRvUmVmKGNvbnRleHQucmVmRGF0ZSwgZGF5LCBtb250aCk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtEQVRFX1RPX0dST1VQXSkge1xuICAgICAgICAgICAgY29uc3QgZW5kRGF0ZSA9IHBhcnNlT3JkaW5hbE51bWJlclBhdHRlcm4obWF0Y2hbREFURV9UT19HUk9VUF0pO1xuICAgICAgICAgICAgcmVzdWx0LmVuZCA9IHJlc3VsdC5zdGFydC5jbG9uZSgpO1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJkYXlcIiwgZW5kRGF0ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTk1vbnRoTmFtZUxpdHRsZUVuZGlhblBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBmaW5kWWVhckNsb3Nlc3RUb1JlZiB9IGZyb20gXCIuLi8uLi8uLi9jYWxjdWxhdGlvbi95ZWFycy5qc1wiO1xuaW1wb3J0IHsgTU9OVEhfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IE9SRElOQUxfTlVNQkVSX1BBVFRFUk4sIHBhcnNlT3JkaW5hbE51bWJlclBhdHRlcm4gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBZRUFSX1BBVFRFUk4sIHBhcnNlWWVhciB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKGAoJHttYXRjaEFueVBhdHRlcm4oTU9OVEhfRElDVElPTkFSWSl9KWAgK1xuICAgIFwiKD86LXwvfFxcXFxzKiw/XFxcXHMqKVwiICtcbiAgICBgKCR7T1JESU5BTF9OVU1CRVJfUEFUVEVSTn0pKD8hXFxcXHMqKD86YW18cG0pKVxcXFxzKmAgK1xuICAgIFwiKD86XCIgK1xuICAgIFwiKD86dG98XFxcXC0pXFxcXHMqXCIgK1xuICAgIGAoJHtPUkRJTkFMX05VTUJFUl9QQVRURVJOfSlcXFxccypgICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD86XCIgK1xuICAgIGAoPzotfC98XFxcXHMqLFxcXFxzKnxcXFxccyspYCArXG4gICAgYCgke1lFQVJfUEFUVEVSTn0pYCArXG4gICAgXCIpP1wiICtcbiAgICBcIig/PVxcXFxXfCQpKD8hXFxcXDpcXFxcZClcIiwgXCJpXCIpO1xuY29uc3QgTU9OVEhfTkFNRV9HUk9VUCA9IDE7XG5jb25zdCBEQVRFX0dST1VQID0gMjtcbmNvbnN0IERBVEVfVE9fR1JPVVAgPSAzO1xuY29uc3QgWUVBUl9HUk9VUCA9IDQ7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBzaG91bGRTa2lwWWVhckxpa2VEYXRlO1xuICAgIGNvbnN0cnVjdG9yKHNob3VsZFNraXBZZWFyTGlrZURhdGUpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5zaG91bGRTa2lwWWVhckxpa2VEYXRlID0gc2hvdWxkU2tpcFllYXJMaWtlRGF0ZTtcbiAgICB9XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gTU9OVEhfRElDVElPTkFSWVttYXRjaFtNT05USF9OQU1FX0dST1VQXS50b0xvd2VyQ2FzZSgpXTtcbiAgICAgICAgY29uc3QgZGF5ID0gcGFyc2VPcmRpbmFsTnVtYmVyUGF0dGVybihtYXRjaFtEQVRFX0dST1VQXSk7XG4gICAgICAgIGlmIChkYXkgPiAzMSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc2hvdWxkU2tpcFllYXJMaWtlRGF0ZSkge1xuICAgICAgICAgICAgaWYgKCFtYXRjaFtEQVRFX1RPX0dST1VQXSAmJiAhbWF0Y2hbWUVBUl9HUk9VUF0gJiYgbWF0Y2hbREFURV9HUk9VUF0ubWF0Y2goL14yWzAtNV0kLykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gY29udGV4dFxuICAgICAgICAgICAgLmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKHtcbiAgICAgICAgICAgIGRheTogZGF5LFxuICAgICAgICAgICAgbW9udGg6IG1vbnRoLFxuICAgICAgICB9KVxuICAgICAgICAgICAgLmFkZFRhZyhcInBhcnNlci9FTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlclwiKTtcbiAgICAgICAgaWYgKG1hdGNoW1lFQVJfR1JPVVBdKSB7XG4gICAgICAgICAgICBjb25zdCB5ZWFyID0gcGFyc2VZZWFyKG1hdGNoW1lFQVJfR1JPVVBdKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBmaW5kWWVhckNsb3Nlc3RUb1JlZihjb250ZXh0LnJlZkRhdGUsIGRheSwgbW9udGgpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcInllYXJcIiwgeWVhcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFtYXRjaFtEQVRFX1RPX0dST1VQXSkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbXBvbmVudHM7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZW5kRGF0ZSA9IHBhcnNlT3JkaW5hbE51bWJlclBhdHRlcm4obWF0Y2hbREFURV9UT19HUk9VUF0pO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQobWF0Y2guaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0ID0gY29tcG9uZW50cztcbiAgICAgICAgcmVzdWx0LmVuZCA9IGNvbXBvbmVudHMuY2xvbmUoKTtcbiAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJkYXlcIiwgZW5kRGF0ZSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5Nb250aE5hbWVNaWRkbGVFbmRpYW5QYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgRlVMTF9NT05USF9OQU1FX0RJQ1RJT05BUlksIE1PTlRIX0RJQ1RJT05BUlkgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBmaW5kWWVhckNsb3Nlc3RUb1JlZiB9IGZyb20gXCIuLi8uLi8uLi9jYWxjdWxhdGlvbi95ZWFycy5qc1wiO1xuaW1wb3J0IHsgbWF0Y2hBbnlQYXR0ZXJuIH0gZnJvbSBcIi4uLy4uLy4uL3V0aWxzL3BhdHRlcm4uanNcIjtcbmltcG9ydCB7IFlFQVJfUEFUVEVSTiwgcGFyc2VZZWFyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5jb25zdCBQQVRURVJOID0gbmV3IFJlZ0V4cChgKCg/OmluKVxcXFxzKik/YCArXG4gICAgYCgke21hdGNoQW55UGF0dGVybihNT05USF9ESUNUSU9OQVJZKX0pYCArXG4gICAgYFxcXFxzKmAgK1xuICAgIGAoPzpgICtcbiAgICBgKD86LHwtfG9mKT9cXFxccyooJHtZRUFSX1BBVFRFUk59KT9gICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD89W15cXFxcc1xcXFx3XXxcXFxccytbXjAtOV18XFxcXHMrJHwkKVwiLCBcImlcIik7XG5jb25zdCBQUkVGSVhfR1JPVVAgPSAxO1xuY29uc3QgTU9OVEhfTkFNRV9HUk9VUCA9IDI7XG5jb25zdCBZRUFSX0dST1VQID0gMztcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTW9udGhOYW1lUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCBtb250aE5hbWUgPSBtYXRjaFtNT05USF9OQU1FX0dST1VQXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZiAobWF0Y2hbMF0ubGVuZ3RoIDw9IDMgJiYgIUZVTExfTU9OVEhfTkFNRV9ESUNUSU9OQVJZW21vbnRoTmFtZV0pIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChtYXRjaC5pbmRleCArIChtYXRjaFtQUkVGSVhfR1JPVVBdIHx8IFwiXCIpLmxlbmd0aCwgbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgMSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hZGRUYWcoXCJwYXJzZXIvRU5Nb250aE5hbWVQYXJzZXJcIik7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gTU9OVEhfRElDVElPTkFSWVttb250aE5hbWVdO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgbW9udGgpO1xuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZVllYXIobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgeWVhcik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB5ZWFyID0gZmluZFllYXJDbG9zZXN0VG9SZWYoY29udGV4dC5yZWZEYXRlLCAxLCBtb250aCk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5Nb250aE5hbWVQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgTU9OVEhfRElDVElPTkFSWSB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7IG1hdGNoQW55UGF0dGVybiB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9wYXR0ZXJuLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKGAoWzAtOV17NH0pWy1cXFxcLlxcXFwvXFxcXHNdYCArXG4gICAgYCg/Oigke21hdGNoQW55UGF0dGVybihNT05USF9ESUNUSU9OQVJZKX0pfChbMC05XXsxLDJ9KSlbLVxcXFwuXFxcXC9cXFxcc11gICtcbiAgICBgKFswLTldezEsMn0pYCArXG4gICAgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBZRUFSX05VTUJFUl9HUk9VUCA9IDE7XG5jb25zdCBNT05USF9OQU1FX0dST1VQID0gMjtcbmNvbnN0IE1PTlRIX05VTUJFUl9HUk9VUCA9IDM7XG5jb25zdCBEQVRFX05VTUJFUl9HUk9VUCA9IDQ7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlllYXJNb250aERheVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBzdHJpY3RNb250aERhdGVPcmRlcjtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb250aERhdGVPcmRlcikge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnN0cmljdE1vbnRoRGF0ZU9yZGVyID0gc3RyaWN0TW9udGhEYXRlT3JkZXI7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCB5ZWFyID0gcGFyc2VJbnQobWF0Y2hbWUVBUl9OVU1CRVJfR1JPVVBdKTtcbiAgICAgICAgbGV0IGRheSA9IHBhcnNlSW50KG1hdGNoW0RBVEVfTlVNQkVSX0dST1VQXSk7XG4gICAgICAgIGxldCBtb250aCA9IG1hdGNoW01PTlRIX05VTUJFUl9HUk9VUF1cbiAgICAgICAgICAgID8gcGFyc2VJbnQobWF0Y2hbTU9OVEhfTlVNQkVSX0dST1VQXSlcbiAgICAgICAgICAgIDogTU9OVEhfRElDVElPTkFSWVttYXRjaFtNT05USF9OQU1FX0dST1VQXS50b0xvd2VyQ2FzZSgpXTtcbiAgICAgICAgaWYgKG1vbnRoIDwgMSB8fCBtb250aCA+IDEyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zdHJpY3RNb250aERhdGVPcmRlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRheSA+PSAxICYmIGRheSA8PSAxMikge1xuICAgICAgICAgICAgICAgIFttb250aCwgZGF5XSA9IFtkYXksIG1vbnRoXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF5IDwgMSB8fCBkYXkgPiAzMSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGRheTogZGF5LFxuICAgICAgICAgICAgbW9udGg6IG1vbnRoLFxuICAgICAgICAgICAgeWVhcjogeWVhcixcbiAgICAgICAgfTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTlllYXJNb250aERheVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKFwiKFswLTldfDBbMS05XXwxWzAxMl0pLyhbMC05XXs0fSlcIiArIFwiXCIsIFwiaVwiKTtcbmNvbnN0IE1PTlRIX0dST1VQID0gMTtcbmNvbnN0IFlFQVJfR1JPVVAgPSAyO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5TbGFzaE1vbnRoRm9ybWF0UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCB5ZWFyID0gcGFyc2VJbnQobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICBjb25zdCBtb250aCA9IHBhcnNlSW50KG1hdGNoW01PTlRIX0dST1VQXSk7XG4gICAgICAgIHJldHVybiBjb250ZXh0LmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKCkuaW1wbHkoXCJkYXlcIiwgMSkuYXNzaWduKFwibW9udGhcIiwgbW9udGgpLmFzc2lnbihcInllYXJcIiwgeWVhcik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5TbGFzaE1vbnRoRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IE1lcmlkaWVtIH0gZnJvbSBcIi4uLy4uL3R5cGVzLmpzXCI7XG5mdW5jdGlvbiBwcmltYXJ5VGltZVBhdHRlcm4obGVmdEJvdW5kYXJ5LCBwcmltYXJ5UHJlZml4LCBwcmltYXJ5U3VmZml4LCBmbGFncykge1xuICAgIHJldHVybiBuZXcgUmVnRXhwKGAke2xlZnRCb3VuZGFyeX1gICtcbiAgICAgICAgYCR7cHJpbWFyeVByZWZpeH1gICtcbiAgICAgICAgYChcXFxcZHsxLDR9KWAgK1xuICAgICAgICBgKD86YCArXG4gICAgICAgIGAoPzpcXFxcLnw6fO+8milgICtcbiAgICAgICAgYChcXFxcZHsxLDJ9KWAgK1xuICAgICAgICBgKD86YCArXG4gICAgICAgIGAoPzo6fO+8milgICtcbiAgICAgICAgYChcXFxcZHsyfSlgICtcbiAgICAgICAgYCg/OlxcXFwuKFxcXFxkezEsNn0pKT9gICtcbiAgICAgICAgYCk/YCArXG4gICAgICAgIGApP2AgK1xuICAgICAgICBgKD86XFxcXHMqKGFcXFxcLm1cXFxcLnxwXFxcXC5tXFxcXC58YW0/fHBtPykpP2AgK1xuICAgICAgICBgJHtwcmltYXJ5U3VmZml4fWAsIGZsYWdzKTtcbn1cbmZ1bmN0aW9uIGZvbGxvd2luZ1RpbWVQYXR0ZW4oZm9sbG93aW5nUGhhc2UsIGZvbGxvd2luZ1N1ZmZpeCkge1xuICAgIHJldHVybiBuZXcgUmVnRXhwKGBeKCR7Zm9sbG93aW5nUGhhc2V9KWAgK1xuICAgICAgICBgKFxcXFxkezEsNH0pYCArXG4gICAgICAgIGAoPzpgICtcbiAgICAgICAgYCg/OlxcXFwufFxcXFw6fFxcXFzvvJopYCArXG4gICAgICAgIGAoXFxcXGR7MSwyfSlgICtcbiAgICAgICAgYCg/OmAgK1xuICAgICAgICBgKD86XFxcXC58XFxcXDp8XFxcXO+8milgICtcbiAgICAgICAgYChcXFxcZHsxLDJ9KSg/OlxcXFwuKFxcXFxkezEsNn0pKT9gICtcbiAgICAgICAgYCk/YCArXG4gICAgICAgIGApP2AgK1xuICAgICAgICBgKD86XFxcXHMqKGFcXFxcLm1cXFxcLnxwXFxcXC5tXFxcXC58YW0/fHBtPykpP2AgK1xuICAgICAgICBgJHtmb2xsb3dpbmdTdWZmaXh9YCwgXCJpXCIpO1xufVxuY29uc3QgSE9VUl9HUk9VUCA9IDI7XG5jb25zdCBNSU5VVEVfR1JPVVAgPSAzO1xuY29uc3QgU0VDT05EX0dST1VQID0gNDtcbmNvbnN0IE1JTExJX1NFQ09ORF9HUk9VUCA9IDU7XG5jb25zdCBBTV9QTV9IT1VSX0dST1VQID0gNjtcbmV4cG9ydCBjbGFzcyBBYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyIHtcbiAgICBzdHJpY3RNb2RlO1xuICAgIGNvbnN0cnVjdG9yKHN0cmljdE1vZGUgPSBmYWxzZSkge1xuICAgICAgICB0aGlzLnN0cmljdE1vZGUgPSBzdHJpY3RNb2RlO1xuICAgIH1cbiAgICBwYXR0ZXJuRmxhZ3MoKSB7XG4gICAgICAgIHJldHVybiBcImlcIjtcbiAgICB9XG4gICAgcHJpbWFyeVBhdHRlcm5MZWZ0Qm91bmRhcnkoKSB7XG4gICAgICAgIHJldHVybiBgKF58XFxcXHN8VHxcXFxcYilgO1xuICAgIH1cbiAgICBwcmltYXJ5U3VmZml4KCkge1xuICAgICAgICByZXR1cm4gYCg/IS8pKD89XFxcXFd8JClgO1xuICAgIH1cbiAgICBmb2xsb3dpbmdTdWZmaXgoKSB7XG4gICAgICAgIHJldHVybiBgKD8hLykoPz1cXFxcV3wkKWA7XG4gICAgfVxuICAgIHBhdHRlcm4oY29udGV4dCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRQcmltYXJ5VGltZVBhdHRlcm5UaHJvdWdoQ2FjaGUoKTtcbiAgICB9XG4gICAgZXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCBzdGFydENvbXBvbmVudHMgPSB0aGlzLmV4dHJhY3RQcmltYXJ5VGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gpO1xuICAgICAgICBpZiAoIXN0YXJ0Q29tcG9uZW50cykge1xuICAgICAgICAgICAgaWYgKG1hdGNoWzBdLm1hdGNoKC9eXFxkezR9LykpIHtcbiAgICAgICAgICAgICAgICBtYXRjaC5pbmRleCArPSA0O1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWF0Y2guaW5kZXggKz0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzFdLmxlbmd0aDtcbiAgICAgICAgY29uc3QgdGV4dCA9IG1hdGNoWzBdLnN1YnN0cmluZyhtYXRjaFsxXS5sZW5ndGgpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQoaW5kZXgsIHRleHQsIHN0YXJ0Q29tcG9uZW50cyk7XG4gICAgICAgIG1hdGNoLmluZGV4ICs9IG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgICAgY29uc3QgcmVtYWluaW5nVGV4dCA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcobWF0Y2guaW5kZXgpO1xuICAgICAgICBjb25zdCBmb2xsb3dpbmdQYXR0ZXJuID0gdGhpcy5nZXRGb2xsb3dpbmdUaW1lUGF0dGVyblRocm91Z2hDYWNoZSgpO1xuICAgICAgICBjb25zdCBmb2xsb3dpbmdNYXRjaCA9IGZvbGxvd2luZ1BhdHRlcm4uZXhlYyhyZW1haW5pbmdUZXh0KTtcbiAgICAgICAgaWYgKHRleHQubWF0Y2goL15cXGR7Myw0fS8pICYmIGZvbGxvd2luZ01hdGNoKSB7XG4gICAgICAgICAgICBpZiAoZm9sbG93aW5nTWF0Y2hbMF0ubWF0Y2goL15cXHMqKFsrLV0pXFxzKlxcZHsyLDR9JC8pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZm9sbG93aW5nTWF0Y2hbMF0ubWF0Y2goL15cXHMqKFsrLV0pXFxzKlxcZHsyfVxcV1xcZHsyfS8pKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFmb2xsb3dpbmdNYXRjaCB8fFxuICAgICAgICAgICAgZm9sbG93aW5nTWF0Y2hbMF0ubWF0Y2goL15cXHMqKFsrLV0pXFxzKlxcZHszLDR9JC8pKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jaGVja0FuZFJldHVybldpdGhvdXRGb2xsb3dpbmdQYXR0ZXJuKHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LmVuZCA9IHRoaXMuZXh0cmFjdEZvbGxvd2luZ1RpbWVDb21wb25lbnRzKGNvbnRleHQsIGZvbGxvd2luZ01hdGNoLCByZXN1bHQpO1xuICAgICAgICBpZiAocmVzdWx0LmVuZCkge1xuICAgICAgICAgICAgcmVzdWx0LnRleHQgKz0gZm9sbG93aW5nTWF0Y2hbMF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuY2hlY2tBbmRSZXR1cm5XaXRoRm9sbG93aW5nUGF0dGVybihyZXN1bHQpO1xuICAgIH1cbiAgICBleHRyYWN0UHJpbWFyeVRpbWVDb21wb25lbnRzKGNvbnRleHQsIG1hdGNoLCBzdHJpY3QgPSBmYWxzZSkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gY29udGV4dC5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cygpO1xuICAgICAgICBsZXQgbWludXRlID0gMDtcbiAgICAgICAgbGV0IG1lcmlkaWVtID0gbnVsbDtcbiAgICAgICAgbGV0IGhvdXIgPSBwYXJzZUludChtYXRjaFtIT1VSX0dST1VQXSk7XG4gICAgICAgIGlmIChob3VyID4gMTAwKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2hbSE9VUl9HUk9VUF0ubGVuZ3RoID09IDQgJiYgbWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBudWxsICYmICFtYXRjaFtBTV9QTV9IT1VSX0dST1VQXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuc3RyaWN0TW9kZSB8fCBtYXRjaFtNSU5VVEVfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1pbnV0ZSA9IGhvdXIgJSAxMDA7XG4gICAgICAgICAgICBob3VyID0gTWF0aC5mbG9vcihob3VyIC8gMTAwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG91ciA+IDI0KSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbTUlOVVRFX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2hbTUlOVVRFX0dST1VQXS5sZW5ndGggPT0gMSAmJiAhbWF0Y2hbQU1fUE1fSE9VUl9HUk9VUF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1pbnV0ZSA9IHBhcnNlSW50KG1hdGNoW01JTlVURV9HUk9VUF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtaW51dGUgPj0gNjApIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID4gMTIpIHtcbiAgICAgICAgICAgIG1lcmlkaWVtID0gTWVyaWRpZW0uUE07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW0FNX1BNX0hPVVJfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChob3VyID4gMTIpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb25zdCBhbXBtID0gbWF0Y2hbQU1fUE1fSE9VUl9HUk9VUF1bMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGlmIChhbXBtID09IFwiYVwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSBNZXJpZGllbS5BTTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMikge1xuICAgICAgICAgICAgICAgICAgICBob3VyID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYW1wbSA9PSBcInBcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gTWVyaWRpZW0uUE07XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpIHtcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIGhvdXIpO1xuICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1pbnV0ZVwiLCBtaW51dGUpO1xuICAgICAgICBpZiAobWVyaWRpZW0gIT09IG51bGwpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWVyaWRpZW1cIiwgbWVyaWRpZW0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKGhvdXIgPCAxMikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtNSUxMSV9TRUNPTkRfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG1pbGxpc2Vjb25kID0gcGFyc2VJbnQobWF0Y2hbTUlMTElfU0VDT05EX0dST1VQXS5zdWJzdHJpbmcoMCwgMykpO1xuICAgICAgICAgICAgaWYgKG1pbGxpc2Vjb25kID49IDEwMDApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1pbGxpc2Vjb25kXCIsIG1pbGxpc2Vjb25kKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbU0VDT05EX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBzZWNvbmQgPSBwYXJzZUludChtYXRjaFtTRUNPTkRfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChzZWNvbmQgPj0gNjApXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInNlY29uZFwiLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnRzO1xuICAgIH1cbiAgICBleHRyYWN0Rm9sbG93aW5nVGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gsIHJlc3VsdCkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gY29udGV4dC5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cygpO1xuICAgICAgICBpZiAobWF0Y2hbTUlMTElfU0VDT05EX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBjb25zdCBtaWxsaXNlY29uZCA9IHBhcnNlSW50KG1hdGNoW01JTExJX1NFQ09ORF9HUk9VUF0uc3Vic3RyaW5nKDAsIDMpKTtcbiAgICAgICAgICAgIGlmIChtaWxsaXNlY29uZCA+PSAxMDAwKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtaWxsaXNlY29uZFwiLCBtaWxsaXNlY29uZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW1NFQ09ORF9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc3Qgc2Vjb25kID0gcGFyc2VJbnQobWF0Y2hbU0VDT05EX0dST1VQXSk7XG4gICAgICAgICAgICBpZiAoc2Vjb25kID49IDYwKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJzZWNvbmRcIiwgc2Vjb25kKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaG91ciA9IHBhcnNlSW50KG1hdGNoW0hPVVJfR1JPVVBdKTtcbiAgICAgICAgbGV0IG1pbnV0ZSA9IDA7XG4gICAgICAgIGxldCBtZXJpZGllbSA9IC0xO1xuICAgICAgICBpZiAobWF0Y2hbTUlOVVRFX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBtaW51dGUgPSBwYXJzZUludChtYXRjaFtNSU5VVEVfR1JPVVBdKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChob3VyID4gMTAwKSB7XG4gICAgICAgICAgICBtaW51dGUgPSBob3VyICUgMTAwO1xuICAgICAgICAgICAgaG91ciA9IE1hdGguZmxvb3IoaG91ciAvIDEwMCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1pbnV0ZSA+PSA2MCB8fCBob3VyID4gMjQpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChob3VyID49IDEyKSB7XG4gICAgICAgICAgICBtZXJpZGllbSA9IE1lcmlkaWVtLlBNO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtBTV9QTV9IT1VSX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoaG91ciA+IDEyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhbXBtID0gbWF0Y2hbQU1fUE1fSE9VUl9HUk9VUF1bMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGlmIChhbXBtID09IFwiYVwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSBNZXJpZGllbS5BTTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciA9PSAxMikge1xuICAgICAgICAgICAgICAgICAgICBob3VyID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnRzLmlzQ2VydGFpbihcImRheVwiKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcImRheVwiLCBjb21wb25lbnRzLmdldChcImRheVwiKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJwXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IE1lcmlkaWVtLlBNO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFyZXN1bHQuc3RhcnQuaXNDZXJ0YWluKFwibWVyaWRpZW1cIikpIHtcbiAgICAgICAgICAgICAgICBpZiAobWVyaWRpZW0gPT0gTWVyaWRpZW0uQU0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uQU0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgPT0gMTIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJob3VyXCIsIDApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSAhPSAxMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImhvdXJcIiwgcmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgKyAxMik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIGhvdXIpO1xuICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1pbnV0ZVwiLCBtaW51dGUpO1xuICAgICAgICBpZiAobWVyaWRpZW0gPj0gMCkge1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtZXJpZGllbVwiLCBtZXJpZGllbSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzdGFydEF0UE0gPSByZXN1bHQuc3RhcnQuaXNDZXJ0YWluKFwibWVyaWRpZW1cIikgJiYgcmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgPiAxMjtcbiAgICAgICAgICAgIGlmIChzdGFydEF0UE0pIHtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgLSAxMiA+IGhvdXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoaG91ciA8PSAxMikge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcImhvdXJcIiwgaG91ciArIDEyKTtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaG91ciA+IDEyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGhvdXIgPD0gMTIpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uQU0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjb21wb25lbnRzLmRhdGUoKS5nZXRUaW1lKCkgPCByZXN1bHQuc3RhcnQuZGF0ZSgpLmdldFRpbWUoKSkge1xuICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcImRheVwiLCBjb21wb25lbnRzLmdldChcImRheVwiKSArIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnRzO1xuICAgIH1cbiAgICBjaGVja0FuZFJldHVybldpdGhvdXRGb2xsb3dpbmdQYXR0ZXJuKHJlc3VsdCkge1xuICAgICAgICBpZiAocmVzdWx0LnRleHQubWF0Y2goL15cXGQkLykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5tYXRjaCgvXlxcZFxcZFxcZCskLykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQudGV4dC5tYXRjaCgvXFxkW2FwQVBdJC8pKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBlbmRpbmdXaXRoTnVtYmVycyA9IHJlc3VsdC50ZXh0Lm1hdGNoKC9bXlxcZDouXShcXGRbXFxkLl0rKSQvKTtcbiAgICAgICAgaWYgKGVuZGluZ1dpdGhOdW1iZXJzKSB7XG4gICAgICAgICAgICBjb25zdCBlbmRpbmdOdW1iZXJzID0gZW5kaW5nV2l0aE51bWJlcnNbMV07XG4gICAgICAgICAgICBpZiAodGhpcy5zdHJpY3RNb2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZW5kaW5nTnVtYmVycy5pbmNsdWRlcyhcIi5cIikgJiYgIWVuZGluZ051bWJlcnMubWF0Y2goL1xcZChcXC5cXGR7Mn0pKyQvKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZW5kaW5nTnVtYmVyVmFsID0gcGFyc2VJbnQoZW5kaW5nTnVtYmVycyk7XG4gICAgICAgICAgICBpZiAoZW5kaW5nTnVtYmVyVmFsID4gMjQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBjaGVja0FuZFJldHVybldpdGhGb2xsb3dpbmdQYXR0ZXJuKHJlc3VsdCkge1xuICAgICAgICBpZiAocmVzdWx0LnRleHQubWF0Y2goL15cXGQrLVxcZCskLykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVuZGluZ1dpdGhOdW1iZXJzID0gcmVzdWx0LnRleHQubWF0Y2goL1teXFxkOi5dKFxcZFtcXGQuXSspXFxzKi1cXHMqKFxcZFtcXGQuXSspJC8pO1xuICAgICAgICBpZiAoZW5kaW5nV2l0aE51bWJlcnMpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnN0cmljdE1vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0aW5nTnVtYmVycyA9IGVuZGluZ1dpdGhOdW1iZXJzWzFdO1xuICAgICAgICAgICAgY29uc3QgZW5kaW5nTnVtYmVycyA9IGVuZGluZ1dpdGhOdW1iZXJzWzJdO1xuICAgICAgICAgICAgaWYgKGVuZGluZ051bWJlcnMuaW5jbHVkZXMoXCIuXCIpICYmICFlbmRpbmdOdW1iZXJzLm1hdGNoKC9cXGQoXFwuXFxkezJ9KSskLykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGVuZGluZ051bWJlclZhbCA9IHBhcnNlSW50KGVuZGluZ051bWJlcnMpO1xuICAgICAgICAgICAgY29uc3Qgc3RhcnRpbmdOdW1iZXJWYWwgPSBwYXJzZUludChzdGFydGluZ051bWJlcnMpO1xuICAgICAgICAgICAgaWYgKGVuZGluZ051bWJlclZhbCA+IDI0IHx8IHN0YXJ0aW5nTnVtYmVyVmFsID4gMjQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbiAgICBjYWNoZWRQcmltYXJ5UHJlZml4ID0gbnVsbDtcbiAgICBjYWNoZWRQcmltYXJ5U3VmZml4ID0gbnVsbDtcbiAgICBjYWNoZWRQcmltYXJ5VGltZVBhdHRlcm4gPSBudWxsO1xuICAgIGdldFByaW1hcnlUaW1lUGF0dGVyblRocm91Z2hDYWNoZSgpIHtcbiAgICAgICAgY29uc3QgcHJpbWFyeVByZWZpeCA9IHRoaXMucHJpbWFyeVByZWZpeCgpO1xuICAgICAgICBjb25zdCBwcmltYXJ5U3VmZml4ID0gdGhpcy5wcmltYXJ5U3VmZml4KCk7XG4gICAgICAgIGlmICh0aGlzLmNhY2hlZFByaW1hcnlQcmVmaXggPT09IHByaW1hcnlQcmVmaXggJiYgdGhpcy5jYWNoZWRQcmltYXJ5U3VmZml4ID09PSBwcmltYXJ5U3VmZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jYWNoZWRQcmltYXJ5VGltZVBhdHRlcm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jYWNoZWRQcmltYXJ5VGltZVBhdHRlcm4gPSBwcmltYXJ5VGltZVBhdHRlcm4odGhpcy5wcmltYXJ5UGF0dGVybkxlZnRCb3VuZGFyeSgpLCBwcmltYXJ5UHJlZml4LCBwcmltYXJ5U3VmZml4LCB0aGlzLnBhdHRlcm5GbGFncygpKTtcbiAgICAgICAgdGhpcy5jYWNoZWRQcmltYXJ5UHJlZml4ID0gcHJpbWFyeVByZWZpeDtcbiAgICAgICAgdGhpcy5jYWNoZWRQcmltYXJ5U3VmZml4ID0gcHJpbWFyeVN1ZmZpeDtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FjaGVkUHJpbWFyeVRpbWVQYXR0ZXJuO1xuICAgIH1cbiAgICBjYWNoZWRGb2xsb3dpbmdQaGFzZSA9IG51bGw7XG4gICAgY2FjaGVkRm9sbG93aW5nU3VmZml4ID0gbnVsbDtcbiAgICBjYWNoZWRGb2xsb3dpbmdUaW1lUGF0dGVuID0gbnVsbDtcbiAgICBnZXRGb2xsb3dpbmdUaW1lUGF0dGVyblRocm91Z2hDYWNoZSgpIHtcbiAgICAgICAgY29uc3QgZm9sbG93aW5nUGhhc2UgPSB0aGlzLmZvbGxvd2luZ1BoYXNlKCk7XG4gICAgICAgIGNvbnN0IGZvbGxvd2luZ1N1ZmZpeCA9IHRoaXMuZm9sbG93aW5nU3VmZml4KCk7XG4gICAgICAgIGlmICh0aGlzLmNhY2hlZEZvbGxvd2luZ1BoYXNlID09PSBmb2xsb3dpbmdQaGFzZSAmJiB0aGlzLmNhY2hlZEZvbGxvd2luZ1N1ZmZpeCA9PT0gZm9sbG93aW5nU3VmZml4KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jYWNoZWRGb2xsb3dpbmdUaW1lUGF0dGVuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2FjaGVkRm9sbG93aW5nVGltZVBhdHRlbiA9IGZvbGxvd2luZ1RpbWVQYXR0ZW4oZm9sbG93aW5nUGhhc2UsIGZvbGxvd2luZ1N1ZmZpeCk7XG4gICAgICAgIHRoaXMuY2FjaGVkRm9sbG93aW5nUGhhc2UgPSBmb2xsb3dpbmdQaGFzZTtcbiAgICAgICAgdGhpcy5jYWNoZWRGb2xsb3dpbmdTdWZmaXggPSBmb2xsb3dpbmdTdWZmaXg7XG4gICAgICAgIHJldHVybiB0aGlzLmNhY2hlZEZvbGxvd2luZ1RpbWVQYXR0ZW47XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9QWJzdHJhY3RUaW1lRXhwcmVzc2lvblBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBNZXJpZGllbSB9IGZyb20gXCIuLi8uLi8uLi90eXBlcy5qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RUaW1lRXhwcmVzc2lvblBhcnNlciB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFRpbWVFeHByZXNzaW9uUGFyc2VyLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlRpbWVFeHByZXNzaW9uUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RUaW1lRXhwcmVzc2lvblBhcnNlciB7XG4gICAgY29uc3RydWN0b3Ioc3RyaWN0TW9kZSkge1xuICAgICAgICBzdXBlcihzdHJpY3RNb2RlKTtcbiAgICB9XG4gICAgZm9sbG93aW5nUGhhc2UoKSB7XG4gICAgICAgIHJldHVybiBcIlxcXFxzKig/OlxcXFwtfFxcXFzigJN8XFxcXH58XFxcXOOAnHx0b3x1bnRpbHx0aHJvdWdofHRpbGx8XFxcXD8pXFxcXHMqXCI7XG4gICAgfVxuICAgIHByaW1hcnlQcmVmaXgoKSB7XG4gICAgICAgIHJldHVybiBcIig/Oig/OmF0fGZyb20pXFxcXHMqKT8/XCI7XG4gICAgfVxuICAgIHByaW1hcnlTdWZmaXgoKSB7XG4gICAgICAgIHJldHVybiBcIig/OlxcXFxzKig/Om9cXFxcVypjbG9ja3xhdFxcXFxzKm5pZ2h0fGluXFxcXHMqdGhlXFxcXHMqKD86bW9ybmluZ3xhZnRlcm5vb24pKSk/KD8hLykoPz1cXFxcV3wkKVwiO1xuICAgIH1cbiAgICBleHRyYWN0UHJpbWFyeVRpbWVDb21wb25lbnRzKGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBzdXBlci5leHRyYWN0UHJpbWFyeVRpbWVDb21wb25lbnRzKGNvbnRleHQsIG1hdGNoKTtcbiAgICAgICAgaWYgKCFjb21wb25lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50cztcbiAgICAgICAgfVxuICAgICAgICBpZiAobWF0Y2hbMF0uZW5kc1dpdGgoXCJuaWdodFwiKSkge1xuICAgICAgICAgICAgY29uc3QgaG91ciA9IGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKTtcbiAgICAgICAgICAgIGlmIChob3VyID49IDYgJiYgaG91ciA8IDEyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJob3VyXCIsIGNvbXBvbmVudHMuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGhvdXIgPCA2KSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoWzBdLmVuZHNXaXRoKFwiYWZ0ZXJub29uXCIpKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICAgICAgICAgIGNvbnN0IGhvdXIgPSBjb21wb25lbnRzLmdldChcImhvdXJcIik7XG4gICAgICAgICAgICBpZiAoaG91ciA+PSAwICYmIGhvdXIgPD0gNikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiaG91clwiLCBjb21wb25lbnRzLmdldChcImhvdXJcIikgKyAxMik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoWzBdLmVuZHNXaXRoKFwibW9ybmluZ1wiKSkge1xuICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtZXJpZGllbVwiLCBNZXJpZGllbS5BTSk7XG4gICAgICAgICAgICBjb25zdCBob3VyID0gY29tcG9uZW50cy5nZXQoXCJob3VyXCIpO1xuICAgICAgICAgICAgaWYgKGhvdXIgPCAxMikge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiaG91clwiLCBjb21wb25lbnRzLmdldChcImhvdXJcIikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnRzLmFkZFRhZyhcInBhcnNlci9FTlRpbWVFeHByZXNzaW9uUGFyc2VyXCIpO1xuICAgIH1cbiAgICBleHRyYWN0Rm9sbG93aW5nVGltZUNvbXBvbmVudHMoY29udGV4dCwgbWF0Y2gsIHJlc3VsdCkge1xuICAgICAgICBjb25zdCBmb2xsb3dpbmdDb21wb25lbnRzID0gc3VwZXIuZXh0cmFjdEZvbGxvd2luZ1RpbWVDb21wb25lbnRzKGNvbnRleHQsIG1hdGNoLCByZXN1bHQpO1xuICAgICAgICBpZiAoZm9sbG93aW5nQ29tcG9uZW50cykge1xuICAgICAgICAgICAgZm9sbG93aW5nQ29tcG9uZW50cy5hZGRUYWcoXCJwYXJzZXIvRU5UaW1lRXhwcmVzc2lvblBhcnNlclwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZm9sbG93aW5nQ29tcG9uZW50cztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTlRpbWVFeHByZXNzaW9uUGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IHBhcnNlRHVyYXRpb24sIFRJTUVfVU5JVFNfTk9fQUJCUl9QQVRURVJOLCBUSU1FX1VOSVRTX1BBVFRFUk4gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cyB9IGZyb20gXCIuLi8uLi8uLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IHJldmVyc2VEdXJhdGlvbiB9IGZyb20gXCIuLi8uLi8uLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCgke1RJTUVfVU5JVFNfUEFUVEVSTn0pXFxcXHN7MCw1fSg/OmFnb3xiZWZvcmV8ZWFybGllcikoPz1cXFxcV3wkKWAsIFwiaVwiKTtcbmNvbnN0IFNUUklDVF9QQVRURVJOID0gbmV3IFJlZ0V4cChgKCR7VElNRV9VTklUU19OT19BQkJSX1BBVFRFUk59KVxcXFxzezAsNX0oPzphZ298YmVmb3JlfGVhcmxpZXIpKD89XFxcXFd8JClgLCBcImlcIik7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlRpbWVVbml0QWdvRm9ybWF0UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIHN0cmljdE1vZGU7XG4gICAgY29uc3RydWN0b3Ioc3RyaWN0TW9kZSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnN0cmljdE1vZGUgPSBzdHJpY3RNb2RlO1xuICAgIH1cbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0cmljdE1vZGUgPyBTVFJJQ1RfUEFUVEVSTiA6IFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCBkdXJhdGlvbiA9IHBhcnNlRHVyYXRpb24obWF0Y2hbMV0pO1xuICAgICAgICBpZiAoIWR1cmF0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCByZXZlcnNlRHVyYXRpb24oZHVyYXRpb24pKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTlRpbWVVbml0QWdvRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IHBhcnNlRHVyYXRpb24sIFRJTUVfVU5JVFNfTk9fQUJCUl9QQVRURVJOLCBUSU1FX1VOSVRTX1BBVFRFUk4gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cyB9IGZyb20gXCIuLi8uLi8uLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKGAoJHtUSU1FX1VOSVRTX1BBVFRFUk59KVxcXFxzezAsNX0oPzpsYXRlcnxhZnRlcnxmcm9tIG5vd3xoZW5jZWZvcnRofGZvcndhcmR8b3V0KWAgKyBcIig/PSg/OlxcXFxXfCQpKVwiLCBcImlcIik7XG5jb25zdCBTVFJJQ1RfUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCgke1RJTUVfVU5JVFNfTk9fQUJCUl9QQVRURVJOfSlcXFxcc3swLDV9KGxhdGVyfGFmdGVyfGZyb20gbm93KSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuY29uc3QgR1JPVVBfTlVNX1RJTUVVTklUUyA9IDE7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgc3RyaWN0TW9kZTtcbiAgICBjb25zdHJ1Y3RvcihzdHJpY3RNb2RlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc3RyaWN0TW9kZSA9IHN0cmljdE1vZGU7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaWN0TW9kZSA/IFNUUklDVF9QQVRURVJOIDogUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHRpbWVVbml0cyA9IHBhcnNlRHVyYXRpb24obWF0Y2hbR1JPVVBfTlVNX1RJTUVVTklUU10pO1xuICAgICAgICBpZiAoIXRpbWVVbml0cykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFBhcnNpbmdDb21wb25lbnRzLmNyZWF0ZVJlbGF0aXZlRnJvbVJlZmVyZW5jZShjb250ZXh0LnJlZmVyZW5jZSwgdGltZVVuaXRzKTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIuanMubWFwIiwiZXhwb3J0IGNsYXNzIEZpbHRlciB7XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHMuZmlsdGVyKChyKSA9PiB0aGlzLmlzVmFsaWQoY29udGV4dCwgcikpO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBNZXJnaW5nUmVmaW5lciB7XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgaWYgKHJlc3VsdHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbWVyZ2VkUmVzdWx0cyA9IFtdO1xuICAgICAgICBsZXQgY3VyUmVzdWx0ID0gcmVzdWx0c1swXTtcbiAgICAgICAgbGV0IG5leHRSZXN1bHQgPSBudWxsO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG5leHRSZXN1bHQgPSByZXN1bHRzW2ldO1xuICAgICAgICAgICAgY29uc3QgdGV4dEJldHdlZW4gPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKGN1clJlc3VsdC5pbmRleCArIGN1clJlc3VsdC50ZXh0Lmxlbmd0aCwgbmV4dFJlc3VsdC5pbmRleCk7XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hvdWxkTWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJSZXN1bHQsIG5leHRSZXN1bHQsIGNvbnRleHQpKSB7XG4gICAgICAgICAgICAgICAgbWVyZ2VkUmVzdWx0cy5wdXNoKGN1clJlc3VsdCk7XG4gICAgICAgICAgICAgICAgY3VyUmVzdWx0ID0gbmV4dFJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxlZnQgPSBjdXJSZXN1bHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgcmlnaHQgPSBuZXh0UmVzdWx0O1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lcmdlZFJlc3VsdCA9IHRoaXMubWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBsZWZ0LCByaWdodCwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gbWVyZ2VkICR7bGVmdH0gYW5kICR7cmlnaHR9IGludG8gJHttZXJnZWRSZXN1bHR9YCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY3VyUmVzdWx0ID0gbWVyZ2VkUmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjdXJSZXN1bHQgIT0gbnVsbCkge1xuICAgICAgICAgICAgbWVyZ2VkUmVzdWx0cy5wdXNoKGN1clJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lcmdlZFJlc3VsdHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YWJzdHJhY3RSZWZpbmVycy5qcy5tYXAiLCJpbXBvcnQgeyBNZXJnaW5nUmVmaW5lciB9IGZyb20gXCIuLi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5pbXBvcnQgeyBhZGREdXJhdGlvbiB9IGZyb20gXCIuLi8uLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIgZXh0ZW5kcyBNZXJnaW5nUmVmaW5lciB7XG4gICAgc2hvdWxkTWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIHJldHVybiAhY3VycmVudFJlc3VsdC5lbmQgJiYgIW5leHRSZXN1bHQuZW5kICYmIHRleHRCZXR3ZWVuLm1hdGNoKHRoaXMucGF0dGVybkJldHdlZW4oKSkgIT0gbnVsbDtcbiAgICB9XG4gICAgbWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBmcm9tUmVzdWx0LCB0b1Jlc3VsdCkge1xuICAgICAgICBpZiAoIWZyb21SZXN1bHQuc3RhcnQuaXNPbmx5V2Vla2RheUNvbXBvbmVudCgpICYmICF0b1Jlc3VsdC5zdGFydC5pc09ubHlXZWVrZGF5Q29tcG9uZW50KCkpIHtcbiAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmdldENlcnRhaW5Db21wb25lbnRzKCkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcm9tUmVzdWx0LnN0YXJ0LmlzQ2VydGFpbihrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21SZXN1bHQuc3RhcnQuaW1wbHkoa2V5LCB0b1Jlc3VsdC5zdGFydC5nZXQoa2V5KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmcm9tUmVzdWx0LnN0YXJ0LmdldENlcnRhaW5Db21wb25lbnRzKCkuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0b1Jlc3VsdC5zdGFydC5pc0NlcnRhaW4oa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB0b1Jlc3VsdC5zdGFydC5pbXBseShrZXksIGZyb21SZXN1bHQuc3RhcnQuZ2V0KGtleSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmcm9tUmVzdWx0LnN0YXJ0LmRhdGUoKSA+IHRvUmVzdWx0LnN0YXJ0LmRhdGUoKSkge1xuICAgICAgICAgICAgbGV0IGZyb21EYXRlID0gZnJvbVJlc3VsdC5zdGFydC5kYXRlKCk7XG4gICAgICAgICAgICBsZXQgdG9EYXRlID0gdG9SZXN1bHQuc3RhcnQuZGF0ZSgpO1xuICAgICAgICAgICAgaWYgKHRvUmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSAmJiBhZGREdXJhdGlvbih0b0RhdGUsIHsgZGF5OiA3IH0pID4gZnJvbURhdGUpIHtcbiAgICAgICAgICAgICAgICB0b0RhdGUgPSBhZGREdXJhdGlvbih0b0RhdGUsIHsgZGF5OiA3IH0pO1xuICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KFwiZGF5XCIsIHRvRGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgICAgIHRvUmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgdG9EYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgICAgICB0b1Jlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgdG9EYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZnJvbVJlc3VsdC5zdGFydC5pc09ubHlXZWVrZGF5Q29tcG9uZW50KCkgJiYgYWRkRHVyYXRpb24oZnJvbURhdGUsIHsgZGF5OiAtNyB9KSA8IHRvRGF0ZSkge1xuICAgICAgICAgICAgICAgIGZyb21EYXRlID0gYWRkRHVyYXRpb24oZnJvbURhdGUsIHsgZGF5OiAtNyB9KTtcbiAgICAgICAgICAgICAgICBmcm9tUmVzdWx0LnN0YXJ0LmltcGx5KFwiZGF5XCIsIGZyb21EYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICAgICAgZnJvbVJlc3VsdC5zdGFydC5pbXBseShcIm1vbnRoXCIsIGZyb21EYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgICAgICBmcm9tUmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCBmcm9tRGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRvUmVzdWx0LnN0YXJ0LmlzRGF0ZVdpdGhVbmtub3duWWVhcigpICYmIGFkZER1cmF0aW9uKHRvRGF0ZSwgeyB5ZWFyOiAxIH0pID4gZnJvbURhdGUpIHtcbiAgICAgICAgICAgICAgICB0b0RhdGUgPSBhZGREdXJhdGlvbih0b0RhdGUsIHsgeWVhcjogMSB9KTtcbiAgICAgICAgICAgICAgICB0b1Jlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgdG9EYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZnJvbVJlc3VsdC5zdGFydC5pc0RhdGVXaXRoVW5rbm93blllYXIoKSAmJiBhZGREdXJhdGlvbihmcm9tRGF0ZSwgeyB5ZWFyOiAtMSB9KSA8IHRvRGF0ZSkge1xuICAgICAgICAgICAgICAgIGZyb21EYXRlID0gYWRkRHVyYXRpb24oZnJvbURhdGUsIHsgeWVhcjogLTEgfSk7XG4gICAgICAgICAgICAgICAgZnJvbVJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgZnJvbURhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBbdG9SZXN1bHQsIGZyb21SZXN1bHRdID0gW2Zyb21SZXN1bHQsIHRvUmVzdWx0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSBmcm9tUmVzdWx0LmNsb25lKCk7XG4gICAgICAgIHJlc3VsdC5zdGFydCA9IGZyb21SZXN1bHQuc3RhcnQ7XG4gICAgICAgIHJlc3VsdC5lbmQgPSB0b1Jlc3VsdC5zdGFydDtcbiAgICAgICAgcmVzdWx0LmluZGV4ID0gTWF0aC5taW4oZnJvbVJlc3VsdC5pbmRleCwgdG9SZXN1bHQuaW5kZXgpO1xuICAgICAgICBpZiAoZnJvbVJlc3VsdC5pbmRleCA8IHRvUmVzdWx0LmluZGV4KSB7XG4gICAgICAgICAgICByZXN1bHQudGV4dCA9IGZyb21SZXN1bHQudGV4dCArIHRleHRCZXR3ZWVuICsgdG9SZXN1bHQudGV4dDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdC50ZXh0ID0gdG9SZXN1bHQudGV4dCArIHRleHRCZXR3ZWVuICsgZnJvbVJlc3VsdC50ZXh0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9QWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIuanMubWFwIiwiaW1wb3J0IEFic3RyYWN0TWVyZ2VEYXRlUmFuZ2VSZWZpbmVyIGZyb20gXCIuLi8uLi8uLi9jb21tb24vcmVmaW5lcnMvQWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyIGV4dGVuZHMgQWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIge1xuICAgIHBhdHRlcm5CZXR3ZWVuKCkge1xuICAgICAgICByZXR1cm4gL15cXHMqKHRvfC184oCTfHVudGlsfHRocm91Z2h8dGlsbClcXHMqJC9pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzLm1hcCIsImltcG9ydCB7IE1lcmlkaWVtIH0gZnJvbSBcIi4uL3R5cGVzLmpzXCI7XG5pbXBvcnQgeyBhc3NpZ25TaW1pbGFyRGF0ZSwgaW1wbHlTaW1pbGFyRGF0ZSB9IGZyb20gXCIuLi91dGlscy9kYXRlcy5qc1wiO1xuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlRGF0ZVRpbWVSZXN1bHQoZGF0ZVJlc3VsdCwgdGltZVJlc3VsdCkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGRhdGVSZXN1bHQuY2xvbmUoKTtcbiAgICBjb25zdCBiZWdpbkRhdGUgPSBkYXRlUmVzdWx0LnN0YXJ0O1xuICAgIGNvbnN0IGJlZ2luVGltZSA9IHRpbWVSZXN1bHQuc3RhcnQ7XG4gICAgcmVzdWx0LnN0YXJ0ID0gbWVyZ2VEYXRlVGltZUNvbXBvbmVudChiZWdpbkRhdGUsIGJlZ2luVGltZSk7XG4gICAgaWYgKGRhdGVSZXN1bHQuZW5kICE9IG51bGwgfHwgdGltZVJlc3VsdC5lbmQgIT0gbnVsbCkge1xuICAgICAgICBjb25zdCBlbmREYXRlID0gZGF0ZVJlc3VsdC5lbmQgPT0gbnVsbCA/IGRhdGVSZXN1bHQuc3RhcnQgOiBkYXRlUmVzdWx0LmVuZDtcbiAgICAgICAgY29uc3QgZW5kVGltZSA9IHRpbWVSZXN1bHQuZW5kID09IG51bGwgPyB0aW1lUmVzdWx0LnN0YXJ0IDogdGltZVJlc3VsdC5lbmQ7XG4gICAgICAgIGNvbnN0IGVuZERhdGVUaW1lID0gbWVyZ2VEYXRlVGltZUNvbXBvbmVudChlbmREYXRlLCBlbmRUaW1lKTtcbiAgICAgICAgaWYgKGRhdGVSZXN1bHQuZW5kID09IG51bGwgJiYgZW5kRGF0ZVRpbWUuZGF0ZSgpLmdldFRpbWUoKSA8IHJlc3VsdC5zdGFydC5kYXRlKCkuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICBjb25zdCBuZXh0RGF5ID0gbmV3IERhdGUoZW5kRGF0ZVRpbWUuZGF0ZSgpLmdldFRpbWUoKSk7XG4gICAgICAgICAgICBuZXh0RGF5LnNldERhdGUobmV4dERheS5nZXREYXRlKCkgKyAxKTtcbiAgICAgICAgICAgIGlmIChlbmREYXRlVGltZS5pc0NlcnRhaW4oXCJkYXlcIikpIHtcbiAgICAgICAgICAgICAgICBhc3NpZ25TaW1pbGFyRGF0ZShlbmREYXRlVGltZSwgbmV4dERheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbXBseVNpbWlsYXJEYXRlKGVuZERhdGVUaW1lLCBuZXh0RGF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuZW5kID0gZW5kRGF0ZVRpbWU7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59XG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VEYXRlVGltZUNvbXBvbmVudChkYXRlQ29tcG9uZW50LCB0aW1lQ29tcG9uZW50KSB7XG4gICAgY29uc3QgZGF0ZVRpbWVDb21wb25lbnQgPSBkYXRlQ29tcG9uZW50LmNsb25lKCk7XG4gICAgaWYgKHRpbWVDb21wb25lbnQuaXNDZXJ0YWluKFwiaG91clwiKSkge1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5hc3NpZ24oXCJob3VyXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwiaG91clwiKSk7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcIm1pbnV0ZVwiLCB0aW1lQ29tcG9uZW50LmdldChcIm1pbnV0ZVwiKSk7XG4gICAgICAgIGlmICh0aW1lQ29tcG9uZW50LmlzQ2VydGFpbihcInNlY29uZFwiKSkge1xuICAgICAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuYXNzaWduKFwic2Vjb25kXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwic2Vjb25kXCIpKTtcbiAgICAgICAgICAgIGlmICh0aW1lQ29tcG9uZW50LmlzQ2VydGFpbihcIm1pbGxpc2Vjb25kXCIpKSB7XG4gICAgICAgICAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuYXNzaWduKFwibWlsbGlzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJtaWxsaXNlY29uZFwiKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWlsbGlzZWNvbmRcIikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuaW1wbHkoXCJzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJzZWNvbmRcIikpO1xuICAgICAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuaW1wbHkoXCJtaWxsaXNlY29uZFwiLCB0aW1lQ29tcG9uZW50LmdldChcIm1pbGxpc2Vjb25kXCIpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuaW1wbHkoXCJob3VyXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwiaG91clwiKSk7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmltcGx5KFwibWludXRlXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWludXRlXCIpKTtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuaW1wbHkoXCJzZWNvbmRcIiwgdGltZUNvbXBvbmVudC5nZXQoXCJzZWNvbmRcIikpO1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWlsbGlzZWNvbmRcIikpO1xuICAgIH1cbiAgICBpZiAodGltZUNvbXBvbmVudC5pc0NlcnRhaW4oXCJ0aW1lem9uZU9mZnNldFwiKSkge1xuICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCB0aW1lQ29tcG9uZW50LmdldChcInRpbWV6b25lT2Zmc2V0XCIpKTtcbiAgICB9XG4gICAgY29uc3QgZGF0ZUhhc01lYW5pbmdmdWxNZXJpZGllbSA9IGRhdGVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikgIT0gbnVsbCAmJlxuICAgICAgICAoZGF0ZUNvbXBvbmVudC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSB8fFxuICAgICAgICAgICAgQXJyYXkuZnJvbShkYXRlQ29tcG9uZW50LnRhZ3MoKSkuc29tZSgodCkgPT4gdC5zdGFydHNXaXRoKFwiY2FzdWFsUmVmZXJlbmNlL1wiKSkpO1xuICAgIGlmICh0aW1lQ29tcG9uZW50LmlzQ2VydGFpbihcIm1lcmlkaWVtXCIpKSB7XG4gICAgICAgIGRhdGVUaW1lQ29tcG9uZW50LmFzc2lnbihcIm1lcmlkaWVtXCIsIHRpbWVDb21wb25lbnQuZ2V0KFwibWVyaWRpZW1cIikpO1xuICAgIH1cbiAgICBlbHNlIGlmICh0aW1lQ29tcG9uZW50LmdldChcIm1lcmlkaWVtXCIpICE9IG51bGwgJiYgIWRhdGVIYXNNZWFuaW5nZnVsTWVyaWRpZW0pIHtcbiAgICAgICAgZGF0ZVRpbWVDb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCB0aW1lQ29tcG9uZW50LmdldChcIm1lcmlkaWVtXCIpKTtcbiAgICB9XG4gICAgaWYgKGRhdGVUaW1lQ29tcG9uZW50LmdldChcIm1lcmlkaWVtXCIpID09IE1lcmlkaWVtLlBNICYmIGRhdGVUaW1lQ29tcG9uZW50LmdldChcImhvdXJcIikgPCAxMikge1xuICAgICAgICBpZiAodGltZUNvbXBvbmVudC5pc0NlcnRhaW4oXCJob3VyXCIpKSB7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5hc3NpZ24oXCJob3VyXCIsIGRhdGVUaW1lQ29tcG9uZW50LmdldChcImhvdXJcIikgKyAxMik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBkYXRlVGltZUNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgZGF0ZVRpbWVDb21wb25lbnQuZ2V0KFwiaG91clwiKSArIDEyKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBkYXRlVGltZUNvbXBvbmVudC5hZGRUYWdzKGRhdGVDb21wb25lbnQudGFncygpKTtcbiAgICBkYXRlVGltZUNvbXBvbmVudC5hZGRUYWdzKHRpbWVDb21wb25lbnQudGFncygpKTtcbiAgICByZXR1cm4gZGF0ZVRpbWVDb21wb25lbnQ7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1tZXJnaW5nQ2FsY3VsYXRpb24uanMubWFwIiwiaW1wb3J0IHsgTWVyZ2luZ1JlZmluZXIgfSBmcm9tIFwiLi4vYWJzdHJhY3RSZWZpbmVycy5qc1wiO1xuaW1wb3J0IHsgbWVyZ2VEYXRlVGltZVJlc3VsdCB9IGZyb20gXCIuLi8uLi9jYWxjdWxhdGlvbi9tZXJnaW5nQ2FsY3VsYXRpb24uanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIgZXh0ZW5kcyBNZXJnaW5nUmVmaW5lciB7XG4gICAgc2hvdWxkTWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIHJldHVybiAoKChjdXJyZW50UmVzdWx0LnN0YXJ0LmlzT25seURhdGUoKSAmJiBuZXh0UmVzdWx0LnN0YXJ0LmlzT25seVRpbWUoKSkgfHxcbiAgICAgICAgICAgIChuZXh0UmVzdWx0LnN0YXJ0LmlzT25seURhdGUoKSAmJiBjdXJyZW50UmVzdWx0LnN0YXJ0LmlzT25seVRpbWUoKSkpICYmXG4gICAgICAgICAgICB0ZXh0QmV0d2Vlbi5tYXRjaCh0aGlzLnBhdHRlcm5CZXR3ZWVuKCkpICE9IG51bGwpO1xuICAgIH1cbiAgICBtZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY3VycmVudFJlc3VsdC5zdGFydC5pc09ubHlEYXRlKClcbiAgICAgICAgICAgID8gbWVyZ2VEYXRlVGltZVJlc3VsdChjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KVxuICAgICAgICAgICAgOiBtZXJnZURhdGVUaW1lUmVzdWx0KG5leHRSZXN1bHQsIGN1cnJlbnRSZXN1bHQpO1xuICAgICAgICByZXN1bHQuaW5kZXggPSBjdXJyZW50UmVzdWx0LmluZGV4O1xuICAgICAgICByZXN1bHQudGV4dCA9IGN1cnJlbnRSZXN1bHQudGV4dCArIHRleHRCZXR3ZWVuICsgbmV4dFJlc3VsdC50ZXh0O1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUFic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIuanMubWFwIiwiaW1wb3J0IEFic3RyYWN0TWVyZ2VEYXRlVGltZVJlZmluZXIgZnJvbSBcIi4uLy4uLy4uL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTk1lcmdlRGF0ZVRpbWVSZWZpbmVyIGV4dGVuZHMgQWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lciB7XG4gICAgcGF0dGVybkJldHdlZW4oKSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnRXhwKFwiXlxcXFxzKihUfGF0fGFmdGVyfGJlZm9yZXxvbnxvZnwsfC18XFxcXC584oiZfDopP1xcXFxzKiRcIik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5NZXJnZURhdGVUaW1lUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgeyB0b1RpbWV6b25lT2Zmc2V0IH0gZnJvbSBcIi4uLy4uL3RpbWV6b25lLmpzXCI7XG5jb25zdCBUSU1FWk9ORV9OQU1FX1BBVFRFUk4gPSBuZXcgUmVnRXhwKFwiXlxcXFxzKiw/XFxcXHMqXFxcXCg/KFtBLVpdezIsNH0pXFxcXCk/KD89XFxcXFd8JClcIiwgXCJpXCIpO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRXh0cmFjdFRpbWV6b25lQWJiclJlZmluZXIge1xuICAgIHRpbWV6b25lT3ZlcnJpZGVzO1xuICAgIGNvbnN0cnVjdG9yKHRpbWV6b25lT3ZlcnJpZGVzKSB7XG4gICAgICAgIHRoaXMudGltZXpvbmVPdmVycmlkZXMgPSB0aW1lem9uZU92ZXJyaWRlcztcbiAgICB9XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgY29uc3QgdGltZXpvbmVPdmVycmlkZXMgPSBjb250ZXh0Lm9wdGlvbi50aW1lem9uZXMgPz8ge307XG4gICAgICAgIHJlc3VsdHMuZm9yRWFjaCgocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzdWZmaXggPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKHJlc3VsdC5pbmRleCArIHJlc3VsdC50ZXh0Lmxlbmd0aCk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaCA9IFRJTUVaT05FX05BTUVfUEFUVEVSTi5leGVjKHN1ZmZpeCk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdGltZXpvbmVBYmJyID0gbWF0Y2hbMV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZkRhdGUgPSByZXN1bHQuc3RhcnQuZGF0ZSgpID8/IHJlc3VsdC5yZWZEYXRlID8/IG5ldyBEYXRlKCk7XG4gICAgICAgICAgICBjb25zdCB0ek92ZXJyaWRlcyA9IHsgLi4udGhpcy50aW1lem9uZU92ZXJyaWRlcywgLi4udGltZXpvbmVPdmVycmlkZXMgfTtcbiAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RlZFRpbWV6b25lT2Zmc2V0ID0gdG9UaW1lem9uZU9mZnNldCh0aW1lem9uZUFiYnIsIHJlZkRhdGUsIHR6T3ZlcnJpZGVzKTtcbiAgICAgICAgICAgIGlmIChleHRyYWN0ZWRUaW1lem9uZU9mZnNldCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEV4dHJhY3RpbmcgdGltZXpvbmU6ICcke3RpbWV6b25lQWJicn0nIGludG86ICR7ZXh0cmFjdGVkVGltZXpvbmVPZmZzZXR9IGZvcjogJHtyZXN1bHQuc3RhcnR9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lem9uZU9mZnNldCA9IHJlc3VsdC5zdGFydC5nZXQoXCJ0aW1lem9uZU9mZnNldFwiKTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50VGltZXpvbmVPZmZzZXQgIT09IG51bGwgJiYgZXh0cmFjdGVkVGltZXpvbmVPZmZzZXQgIT0gY3VycmVudFRpbWV6b25lT2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJ0aW1lem9uZU9mZnNldFwiKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aW1lem9uZUFiYnIgIT0gbWF0Y2hbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhcnQuaXNPbmx5RGF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRpbWV6b25lQWJiciAhPSBtYXRjaFsxXSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnRleHQgKz0gbWF0Y2hbMF07XG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJ0aW1lem9uZU9mZnNldFwiKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCBleHRyYWN0ZWRUaW1lem9uZU9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAhPSBudWxsICYmICFyZXN1bHQuZW5kLmlzQ2VydGFpbihcInRpbWV6b25lT2Zmc2V0XCIpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJ0aW1lem9uZU9mZnNldFwiLCBleHRyYWN0ZWRUaW1lem9uZU9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lci5qcy5tYXAiLCJjb25zdCBUSU1FWk9ORV9PRkZTRVRfUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCJeXFxcXHMqKD86XFxcXCg/KD86R01UfFVUQylcXFxccz8pPyhbKy1dKShcXFxcZHsxLDJ9KSg/Ojo/KFxcXFxkezJ9KSk/XFxcXCk/XCIsIFwiaVwiKTtcbmNvbnN0IFRJTUVaT05FX09GRlNFVF9TSUdOX0dST1VQID0gMTtcbmNvbnN0IFRJTUVaT05FX09GRlNFVF9IT1VSX09GRlNFVF9HUk9VUCA9IDI7XG5jb25zdCBUSU1FWk9ORV9PRkZTRVRfTUlOVVRFX09GRlNFVF9HUk9VUCA9IDM7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyIHtcbiAgICByZWZpbmUoY29udGV4dCwgcmVzdWx0cykge1xuICAgICAgICByZXN1bHRzLmZvckVhY2goZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJ0aW1lem9uZU9mZnNldFwiKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcocmVzdWx0LmluZGV4ICsgcmVzdWx0LnRleHQubGVuZ3RoKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gVElNRVpPTkVfT0ZGU0VUX1BBVFRFUk4uZXhlYyhzdWZmaXgpO1xuICAgICAgICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBFeHRyYWN0aW5nIHRpbWV6b25lOiAnJHttYXRjaFswXX0nIGludG8gOiAke3Jlc3VsdH1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgaG91ck9mZnNldCA9IHBhcnNlSW50KG1hdGNoW1RJTUVaT05FX09GRlNFVF9IT1VSX09GRlNFVF9HUk9VUF0pO1xuICAgICAgICAgICAgY29uc3QgbWludXRlT2Zmc2V0ID0gcGFyc2VJbnQobWF0Y2hbVElNRVpPTkVfT0ZGU0VUX01JTlVURV9PRkZTRVRfR1JPVVBdIHx8IFwiMFwiKTtcbiAgICAgICAgICAgIGxldCB0aW1lem9uZU9mZnNldCA9IGhvdXJPZmZzZXQgKiA2MCArIG1pbnV0ZU9mZnNldDtcbiAgICAgICAgICAgIGlmICh0aW1lem9uZU9mZnNldCA+IDE0ICogNjApIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hbVElNRVpPTkVfT0ZGU0VUX1NJR05fR1JPVVBdID09PSBcIi1cIikge1xuICAgICAgICAgICAgICAgIHRpbWV6b25lT2Zmc2V0ID0gLXRpbWV6b25lT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlc3VsdC5lbmQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwidGltZXpvbmVPZmZzZXRcIiwgdGltZXpvbmVPZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInRpbWV6b25lT2Zmc2V0XCIsIHRpbWV6b25lT2Zmc2V0KTtcbiAgICAgICAgICAgIHJlc3VsdC50ZXh0ICs9IG1hdGNoWzBdO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RXh0cmFjdFRpbWV6b25lT2Zmc2V0UmVmaW5lci5qcy5tYXAiLCJleHBvcnQgZGVmYXVsdCBjbGFzcyBPdmVybGFwUmVtb3ZhbFJlZmluZXIge1xuICAgIHJlZmluZShjb250ZXh0LCByZXN1bHRzKSB7XG4gICAgICAgIGlmIChyZXN1bHRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGZpbHRlcmVkUmVzdWx0cyA9IFtdO1xuICAgICAgICBsZXQgcHJldlJlc3VsdCA9IHJlc3VsdHNbMF07XG4gICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gcmVzdWx0c1tpXTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQuaW5kZXggPj0gcHJldlJlc3VsdC5pbmRleCArIHByZXZSZXN1bHQudGV4dC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChwcmV2UmVzdWx0KTtcbiAgICAgICAgICAgICAgICBwcmV2UmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGtlcHQgPSBudWxsO1xuICAgICAgICAgICAgbGV0IHJlbW92ZWQgPSBudWxsO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC50ZXh0Lmxlbmd0aCA+IHByZXZSZXN1bHQudGV4dC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBrZXB0ID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgIHJlbW92ZWQgPSBwcmV2UmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAga2VwdCA9IHByZXZSZXN1bHQ7XG4gICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gcmVtb3ZlICR7cmVtb3ZlZH0gYnkgJHtrZXB0fWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwcmV2UmVzdWx0ID0ga2VwdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJldlJlc3VsdCAhPSBudWxsKSB7XG4gICAgICAgICAgICBmaWx0ZXJlZFJlc3VsdHMucHVzaChwcmV2UmVzdWx0KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsdGVyZWRSZXN1bHRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPU92ZXJsYXBSZW1vdmFsUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgeyBXZWVrZGF5IH0gZnJvbSBcIi4uL3R5cGVzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cyB9IGZyb20gXCIuLi9yZXN1bHRzLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGFyc2luZ0NvbXBvbmVudHNBdFdlZWtkYXkocmVmZXJlbmNlLCB3ZWVrZGF5LCBtb2RpZmllcikge1xuICAgIGNvbnN0IHJlZkRhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgZGF5c1RvV2Vla2RheSA9IGdldERheXNUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSwgbW9kaWZpZXIpO1xuICAgIGxldCBjb21wb25lbnRzID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSk7XG4gICAgY29tcG9uZW50cyA9IGNvbXBvbmVudHMuYWRkRHVyYXRpb25Bc0ltcGxpZWQoeyBkYXk6IGRheXNUb1dlZWtkYXkgfSk7XG4gICAgY29tcG9uZW50cy5hc3NpZ24oXCJ3ZWVrZGF5XCIsIHdlZWtkYXkpO1xuICAgIHJldHVybiBjb21wb25lbnRzO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldERheXNUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSwgbW9kaWZpZXIpIHtcbiAgICBjb25zdCByZWZXZWVrZGF5ID0gcmVmRGF0ZS5nZXREYXkoKTtcbiAgICBzd2l0Y2ggKG1vZGlmaWVyKSB7XG4gICAgICAgIGNhc2UgXCJ0aGlzXCI6XG4gICAgICAgICAgICByZXR1cm4gZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSk7XG4gICAgICAgIGNhc2UgXCJsYXN0XCI6XG4gICAgICAgICAgICByZXR1cm4gZ2V0QmFja3dhcmREYXlzVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpO1xuICAgICAgICBjYXNlIFwibmV4dFwiOlxuICAgICAgICAgICAgaWYgKHJlZldlZWtkYXkgPT0gV2Vla2RheS5TVU5EQVkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd2Vla2RheSA9PSBXZWVrZGF5LlNVTkRBWSA/IDcgOiB3ZWVrZGF5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlZldlZWtkYXkgPT0gV2Vla2RheS5TQVRVUkRBWSkge1xuICAgICAgICAgICAgICAgIGlmICh3ZWVrZGF5ID09IFdlZWtkYXkuU0FUVVJEQVkpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiA3O1xuICAgICAgICAgICAgICAgIGlmICh3ZWVrZGF5ID09IFdlZWtkYXkuU1VOREFZKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gODtcbiAgICAgICAgICAgICAgICByZXR1cm4gMSArIHdlZWtkYXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAod2Vla2RheSA8IHJlZldlZWtkYXkgJiYgd2Vla2RheSAhPSBXZWVrZGF5LlNVTkRBWSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXREYXlzRm9yd2FyZFRvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBnZXREYXlzRm9yd2FyZFRvV2Vla2RheShyZWZEYXRlLCB3ZWVrZGF5KSArIDc7XG4gICAgICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBnZXREYXlzVG9XZWVrZGF5Q2xvc2VzdChyZWZEYXRlLCB3ZWVrZGF5KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXREYXlzVG9XZWVrZGF5Q2xvc2VzdChyZWZEYXRlLCB3ZWVrZGF5KSB7XG4gICAgY29uc3QgYmFja3dhcmQgPSBnZXRCYWNrd2FyZERheXNUb1dlZWtkYXkocmVmRGF0ZSwgd2Vla2RheSk7XG4gICAgY29uc3QgZm9yd2FyZCA9IGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpO1xuICAgIHJldHVybiBmb3J3YXJkIDwgLWJhY2t3YXJkID8gZm9yd2FyZCA6IGJhY2t3YXJkO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldERheXNGb3J3YXJkVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpIHtcbiAgICBjb25zdCByZWZXZWVrZGF5ID0gcmVmRGF0ZS5nZXREYXkoKTtcbiAgICBsZXQgZm9yd2FyZENvdW50ID0gd2Vla2RheSAtIHJlZldlZWtkYXk7XG4gICAgaWYgKGZvcndhcmRDb3VudCA8IDApIHtcbiAgICAgICAgZm9yd2FyZENvdW50ICs9IDc7XG4gICAgfVxuICAgIHJldHVybiBmb3J3YXJkQ291bnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0QmFja3dhcmREYXlzVG9XZWVrZGF5KHJlZkRhdGUsIHdlZWtkYXkpIHtcbiAgICBjb25zdCByZWZXZWVrZGF5ID0gcmVmRGF0ZS5nZXREYXkoKTtcbiAgICBsZXQgYmFja3dhcmRDb3VudCA9IHdlZWtkYXkgLSByZWZXZWVrZGF5O1xuICAgIGlmIChiYWNrd2FyZENvdW50ID49IDApIHtcbiAgICAgICAgYmFja3dhcmRDb3VudCAtPSA3O1xuICAgIH1cbiAgICByZXR1cm4gYmFja3dhcmRDb3VudDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXdlZWtkYXlzLmpzLm1hcCIsImltcG9ydCAqIGFzIGRhdGVzIGZyb20gXCIuLi8uLi91dGlscy9kYXRlcy5qc1wiO1xuaW1wb3J0IHsgaW1wbHlTaW1pbGFyRGF0ZSB9IGZyb20gXCIuLi8uLi91dGlscy9kYXRlcy5qc1wiO1xuaW1wb3J0IHsgYWRkRHVyYXRpb24gfSBmcm9tIFwiLi4vLi4vY2FsY3VsYXRpb24vZHVyYXRpb24uanNcIjtcbmltcG9ydCB7IGdldERheXNGb3J3YXJkVG9XZWVrZGF5IH0gZnJvbSBcIi4uLy4uL2NhbGN1bGF0aW9uL3dlZWtkYXlzLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGb3J3YXJkRGF0ZVJlZmluZXIge1xuICAgIHJlZmluZShjb250ZXh0LCByZXN1bHRzKSB7XG4gICAgICAgIGlmICghY29udGV4dC5vcHRpb24uZm9yd2FyZERhdGUpIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdHMuZm9yRWFjaCgocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBsZXQgcmVmRGF0ZSA9IGNvbnRleHQucmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc09ubHlUaW1lKCkgJiYgY29udGV4dC5yZWZlcmVuY2UuaW5zdGFudCA+IHJlc3VsdC5zdGFydC5kYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWZEYXRlID0gY29udGV4dC5yZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVmRm9sbG93aW5nRGF5ID0gbmV3IERhdGUocmVmRGF0ZSk7XG4gICAgICAgICAgICAgICAgcmVmRm9sbG93aW5nRGF5LnNldERhdGUocmVmRm9sbG93aW5nRGF5LmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgICAgIGRhdGVzLmltcGx5U2ltaWxhckRhdGUocmVzdWx0LnN0YXJ0LCByZWZGb2xsb3dpbmdEYXkpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGFkanVzdGVkICR7cmVzdWx0fSB0aW1lIGZyb20gdGhlIHJlZiBkYXRlICgke3JlZkRhdGV9KSB0byB0aGUgZm9sbG93aW5nIGRheSAoJHtyZWZGb2xsb3dpbmdEYXl9KWApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuZW5kICYmIHJlc3VsdC5lbmQuaXNPbmx5VGltZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGVzLmltcGx5U2ltaWxhckRhdGUocmVzdWx0LmVuZCwgcmVmRm9sbG93aW5nRGF5KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5kYXRlKCkgPiByZXN1bHQuZW5kLmRhdGUoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVmRm9sbG93aW5nRGF5LnNldERhdGUocmVmRm9sbG93aW5nRGF5LmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0ZXMuaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuZW5kLCByZWZGb2xsb3dpbmdEYXkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc09ubHlXZWVrZGF5Q29tcG9uZW50KCkgJiYgcmVmRGF0ZSA+IHJlc3VsdC5zdGFydC5kYXRlKCkpIHtcbiAgICAgICAgICAgICAgICBsZXQgZGF5c1RvQWRkID0gZ2V0RGF5c0ZvcndhcmRUb1dlZWtkYXkocmVmRGF0ZSwgcmVzdWx0LnN0YXJ0LmdldChcIndlZWtkYXlcIikpIHx8IDc7XG4gICAgICAgICAgICAgICAgY29uc3QgZm9yd2FyZGVkV2Vla2RheSA9IGFkZER1cmF0aW9uKHJlZkRhdGUsIHsgZGF5OiBkYXlzVG9BZGQgfSk7XG4gICAgICAgICAgICAgICAgaW1wbHlTaW1pbGFyRGF0ZShyZXN1bHQuc3RhcnQsIGZvcndhcmRlZFdlZWtkYXkpO1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGFkanVzdGVkICR7cmVzdWx0fSB3ZWVrZGF5ICgke3Jlc3VsdC5zdGFydH0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5lbmQgJiYgcmVzdWx0LnN0YXJ0LmRhdGUoKSA+IHJlc3VsdC5lbmQuZGF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBkYXlzVG9BZGQgPSBnZXREYXlzRm9yd2FyZFRvV2Vla2RheShyZWZEYXRlLCByZXN1bHQuc3RhcnQuZ2V0KFwid2Vla2RheVwiKSkgfHwgNztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9yd2FyZGVkV2Vla2RheSA9IGFkZER1cmF0aW9uKHJlZkRhdGUsIHsgZGF5OiBkYXlzVG9BZGQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGltcGx5U2ltaWxhckRhdGUocmVzdWx0LmVuZCwgZm9yd2FyZGVkV2Vla2RheSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBhZGp1c3RlZCAke3Jlc3VsdH0gd2Vla2RheSAoJHtyZXN1bHQuZW5kfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc0RhdGVXaXRoVW5rbm93blllYXIoKSAmJiByZWZEYXRlID4gcmVzdWx0LnN0YXJ0LmRhdGUoKSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMyAmJiByZWZEYXRlID4gcmVzdWx0LnN0YXJ0LmRhdGUoKTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgcmVzdWx0LnN0YXJ0LmdldChcInllYXJcIikgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9IGFkanVzdGVkICR7cmVzdWx0fSB5ZWFyICgke3Jlc3VsdC5zdGFydH0pYCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmVuZCAmJiAhcmVzdWx0LmVuZC5pc0NlcnRhaW4oXCJ5ZWFyXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwieWVhclwiLCByZXN1bHQuZW5kLmdldChcInllYXJcIikgKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gYWRqdXN0ZWQgJHtyZXN1bHR9IG1vbnRoICgke3Jlc3VsdC5zdGFydH0pYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUZvcndhcmREYXRlUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgeyBGaWx0ZXIgfSBmcm9tIFwiLi4vYWJzdHJhY3RSZWZpbmVycy5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVW5saWtlbHlGb3JtYXRGaWx0ZXIgZXh0ZW5kcyBGaWx0ZXIge1xuICAgIHN0cmljdE1vZGU7XG4gICAgY29uc3RydWN0b3Ioc3RyaWN0TW9kZSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnN0cmljdE1vZGUgPSBzdHJpY3RNb2RlO1xuICAgIH1cbiAgICBpc1ZhbGlkKGNvbnRleHQsIHJlc3VsdCkge1xuICAgICAgICBpZiAocmVzdWx0LnRleHQucmVwbGFjZShcIiBcIiwgXCJcIikubWF0Y2goL15cXGQqKFxcLlxcZCopPyQvKSkge1xuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFJlbW92aW5nIHVubGlrZWx5IHJlc3VsdCAnJHtyZXN1bHQudGV4dH0nYCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXJlc3VsdC5zdGFydC5pc1ZhbGlkRGF0ZSgpKSB7XG4gICAgICAgICAgICBjb250ZXh0LmRlYnVnKCgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVtb3ZpbmcgaW52YWxpZCByZXN1bHQ6ICR7cmVzdWx0fSAoJHtyZXN1bHQuc3RhcnR9KWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlc3VsdC5lbmQgJiYgIXJlc3VsdC5lbmQuaXNWYWxpZERhdGUoKSkge1xuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFJlbW92aW5nIGludmFsaWQgcmVzdWx0OiAke3Jlc3VsdH0gKCR7cmVzdWx0LmVuZH0pYCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdHJpY3RNb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1N0cmljdE1vZGVWYWxpZChjb250ZXh0LCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpc1N0cmljdE1vZGVWYWxpZChjb250ZXh0LCByZXN1bHQpIHtcbiAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5pc09ubHlXZWVrZGF5Q29tcG9uZW50KCkpIHtcbiAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGAoU3RyaWN0KSBSZW1vdmluZyB3ZWVrZGF5IG9ubHkgY29tcG9uZW50OiAke3Jlc3VsdH0gKCR7cmVzdWx0LmVuZH0pYCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1Vbmxpa2VseUZvcm1hdEZpbHRlci5qcy5tYXAiLCJpbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoWzAtOV17NH0pXFxcXC0oWzAtOV17MSwyfSlcXFxcLShbMC05XXsxLDJ9KVwiICtcbiAgICBcIig/OlRcIiArXG4gICAgXCIoWzAtOV17MSwyfSk6KFswLTldezEsMn0pXCIgK1xuICAgIFwiKD86XCIgK1xuICAgIFwiOihbMC05XXsxLDJ9KSg/OlxcXFwuKFxcXFxkezEsNH0pKT9cIiArXG4gICAgXCIpP1wiICtcbiAgICBcIihcIiArXG4gICAgXCJafChbKy1dXFxcXGR7Mn0pOj8oXFxcXGR7Mn0pP1wiICtcbiAgICBcIik/XCIgK1xuICAgIFwiKT9cIiArXG4gICAgXCIoPz1cXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBZRUFSX05VTUJFUl9HUk9VUCA9IDE7XG5jb25zdCBNT05USF9OVU1CRVJfR1JPVVAgPSAyO1xuY29uc3QgREFURV9OVU1CRVJfR1JPVVAgPSAzO1xuY29uc3QgSE9VUl9OVU1CRVJfR1JPVVAgPSA0O1xuY29uc3QgTUlOVVRFX05VTUJFUl9HUk9VUCA9IDU7XG5jb25zdCBTRUNPTkRfTlVNQkVSX0dST1VQID0gNjtcbmNvbnN0IE1JTExJU0VDT05EX05VTUJFUl9HUk9VUCA9IDc7XG5jb25zdCBUWkRfR1JPVVAgPSA4O1xuY29uc3QgVFpEX0hPVVJfT0ZGU0VUX0dST1VQID0gOTtcbmNvbnN0IFRaRF9NSU5VVEVfT0ZGU0VUX0dST1VQID0gMTA7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBJU09Gb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKHtcbiAgICAgICAgICAgIFwieWVhclwiOiBwYXJzZUludChtYXRjaFtZRUFSX05VTUJFUl9HUk9VUF0pLFxuICAgICAgICAgICAgXCJtb250aFwiOiBwYXJzZUludChtYXRjaFtNT05USF9OVU1CRVJfR1JPVVBdKSxcbiAgICAgICAgICAgIFwiZGF5XCI6IHBhcnNlSW50KG1hdGNoW0RBVEVfTlVNQkVSX0dST1VQXSksXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobWF0Y2hbSE9VUl9OVU1CRVJfR1JPVVBdICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwiaG91clwiLCBwYXJzZUludChtYXRjaFtIT1VSX05VTUJFUl9HUk9VUF0pKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibWludXRlXCIsIHBhcnNlSW50KG1hdGNoW01JTlVURV9OVU1CRVJfR1JPVVBdKSk7XG4gICAgICAgICAgICBpZiAobWF0Y2hbU0VDT05EX05VTUJFUl9HUk9VUF0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwic2Vjb25kXCIsIHBhcnNlSW50KG1hdGNoW1NFQ09ORF9OVU1CRVJfR1JPVVBdKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hbTUlMTElTRUNPTkRfTlVNQkVSX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50cy5hc3NpZ24oXCJtaWxsaXNlY29uZFwiLCBwYXJzZUludChtYXRjaFtNSUxMSVNFQ09ORF9OVU1CRVJfR1JPVVBdKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hbVFpEX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbGV0IG9mZnNldCA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoW1RaRF9IT1VSX09GRlNFVF9HUk9VUF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaG91ck9mZnNldCA9IHBhcnNlSW50KG1hdGNoW1RaRF9IT1VSX09GRlNFVF9HUk9VUF0pO1xuICAgICAgICAgICAgICAgICAgICBsZXQgbWludXRlT2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoW1RaRF9NSU5VVEVfT0ZGU0VUX0dST1VQXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtaW51dGVPZmZzZXQgPSBwYXJzZUludChtYXRjaFtUWkRfTUlOVVRFX09GRlNFVF9HUk9VUF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG9mZnNldCA9IGhvdXJPZmZzZXQgKiA2MDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9mZnNldCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9mZnNldCAtPSBtaW51dGVPZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbWludXRlT2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwidGltZXpvbmVPZmZzZXRcIiwgb2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcG9uZW50cy5hZGRUYWcoXCJwYXJzZXIvSVNPRm9ybWF0UGFyc2VyXCIpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUlTT0Zvcm1hdFBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBNZXJnaW5nUmVmaW5lciB9IGZyb20gXCIuLi9hYnN0cmFjdFJlZmluZXJzLmpzXCI7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNZXJnZVdlZWtkYXlDb21wb25lbnRSZWZpbmVyIGV4dGVuZHMgTWVyZ2luZ1JlZmluZXIge1xuICAgIG1lcmdlUmVzdWx0cyh0ZXh0QmV0d2VlbiwgY3VycmVudFJlc3VsdCwgbmV4dFJlc3VsdCkge1xuICAgICAgICBjb25zdCBuZXdSZXN1bHQgPSBuZXh0UmVzdWx0LmNsb25lKCk7XG4gICAgICAgIG5ld1Jlc3VsdC5pbmRleCA9IGN1cnJlbnRSZXN1bHQuaW5kZXg7XG4gICAgICAgIG5ld1Jlc3VsdC50ZXh0ID0gY3VycmVudFJlc3VsdC50ZXh0ICsgdGV4dEJldHdlZW4gKyBuZXdSZXN1bHQudGV4dDtcbiAgICAgICAgbmV3UmVzdWx0LnN0YXJ0LmFzc2lnbihcIndlZWtkYXlcIiwgY3VycmVudFJlc3VsdC5zdGFydC5nZXQoXCJ3ZWVrZGF5XCIpKTtcbiAgICAgICAgaWYgKG5ld1Jlc3VsdC5lbmQpIHtcbiAgICAgICAgICAgIG5ld1Jlc3VsdC5lbmQuYXNzaWduKFwid2Vla2RheVwiLCBjdXJyZW50UmVzdWx0LnN0YXJ0LmdldChcIndlZWtkYXlcIikpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdSZXN1bHQ7XG4gICAgfVxuICAgIHNob3VsZE1lcmdlUmVzdWx0cyh0ZXh0QmV0d2VlbiwgY3VycmVudFJlc3VsdCwgbmV4dFJlc3VsdCkge1xuICAgICAgICBjb25zdCB3ZWVrZGF5VGhlbk5vcm1hbERhdGUgPSBjdXJyZW50UmVzdWx0LnN0YXJ0LmlzT25seVdlZWtkYXlDb21wb25lbnQoKSAmJlxuICAgICAgICAgICAgIWN1cnJlbnRSZXN1bHQuc3RhcnQuaXNDZXJ0YWluKFwiaG91clwiKSAmJlxuICAgICAgICAgICAgbmV4dFJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJkYXlcIik7XG4gICAgICAgIHJldHVybiB3ZWVrZGF5VGhlbk5vcm1hbERhdGUgJiYgdGV4dEJldHdlZW4ubWF0Y2goL14sP1xccyokLykgIT0gbnVsbDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1NZXJnZVdlZWtkYXlDb21wb25lbnRSZWZpbmVyLmpzLm1hcCIsImltcG9ydCBFeHRyYWN0VGltZXpvbmVBYmJyUmVmaW5lciBmcm9tIFwiLi9jb21tb24vcmVmaW5lcnMvRXh0cmFjdFRpbWV6b25lQWJiclJlZmluZXIuanNcIjtcbmltcG9ydCBFeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyIGZyb20gXCIuL2NvbW1vbi9yZWZpbmVycy9FeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyLmpzXCI7XG5pbXBvcnQgT3ZlcmxhcFJlbW92YWxSZWZpbmVyIGZyb20gXCIuL2NvbW1vbi9yZWZpbmVycy9PdmVybGFwUmVtb3ZhbFJlZmluZXIuanNcIjtcbmltcG9ydCBGb3J3YXJkRGF0ZVJlZmluZXIgZnJvbSBcIi4vY29tbW9uL3JlZmluZXJzL0ZvcndhcmREYXRlUmVmaW5lci5qc1wiO1xuaW1wb3J0IFVubGlrZWx5Rm9ybWF0RmlsdGVyIGZyb20gXCIuL2NvbW1vbi9yZWZpbmVycy9Vbmxpa2VseUZvcm1hdEZpbHRlci5qc1wiO1xuaW1wb3J0IElTT0Zvcm1hdFBhcnNlciBmcm9tIFwiLi9jb21tb24vcGFyc2Vycy9JU09Gb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBNZXJnZVdlZWtkYXlDb21wb25lbnRSZWZpbmVyIGZyb20gXCIuL2NvbW1vbi9yZWZpbmVycy9NZXJnZVdlZWtkYXlDb21wb25lbnRSZWZpbmVyLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbiwgc3RyaWN0TW9kZSA9IGZhbHNlKSB7XG4gICAgY29uZmlndXJhdGlvbi5wYXJzZXJzLnVuc2hpZnQobmV3IElTT0Zvcm1hdFBhcnNlcigpKTtcbiAgICBjb25maWd1cmF0aW9uLnJlZmluZXJzLnVuc2hpZnQobmV3IE1lcmdlV2Vla2RheUNvbXBvbmVudFJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy51bnNoaWZ0KG5ldyBFeHRyYWN0VGltZXpvbmVPZmZzZXRSZWZpbmVyKCkpO1xuICAgIGNvbmZpZ3VyYXRpb24ucmVmaW5lcnMudW5zaGlmdChuZXcgT3ZlcmxhcFJlbW92YWxSZWZpbmVyKCkpO1xuICAgIGNvbmZpZ3VyYXRpb24ucmVmaW5lcnMucHVzaChuZXcgRXh0cmFjdFRpbWV6b25lQWJiclJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy5wdXNoKG5ldyBPdmVybGFwUmVtb3ZhbFJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy5wdXNoKG5ldyBGb3J3YXJkRGF0ZVJlZmluZXIoKSk7XG4gICAgY29uZmlndXJhdGlvbi5yZWZpbmVycy5wdXNoKG5ldyBVbmxpa2VseUZvcm1hdEZpbHRlcihzdHJpY3RNb2RlKSk7XG4gICAgcmV0dXJuIGNvbmZpZ3VyYXRpb247XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb25maWd1cmF0aW9ucy5qcy5tYXAiLCJpbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cyB9IGZyb20gXCIuLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBhc3NpZ25TaW1pbGFyRGF0ZSwgYXNzaWduU2ltaWxhclRpbWUsIGltcGx5U2ltaWxhclRpbWUgfSBmcm9tIFwiLi4vdXRpbHMvZGF0ZXMuanNcIjtcbmltcG9ydCB7IE1lcmlkaWVtIH0gZnJvbSBcIi4uL3R5cGVzLmpzXCI7XG5leHBvcnQgZnVuY3Rpb24gbm93KHJlZmVyZW5jZSkge1xuICAgIGNvbnN0IHRhcmdldERhdGUgPSByZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCk7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGFzc2lnblNpbWlsYXJEYXRlKGNvbXBvbmVudCwgdGFyZ2V0RGF0ZSk7XG4gICAgYXNzaWduU2ltaWxhclRpbWUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBjb21wb25lbnQuYXNzaWduKFwidGltZXpvbmVPZmZzZXRcIiwgcmVmZXJlbmNlLmdldFRpbWV6b25lT2Zmc2V0KCkpO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2Uvbm93XCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9kYXkocmVmZXJlbmNlKSB7XG4gICAgY29uc3QgdGFyZ2V0RGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBpbXBseVNpbWlsYXJUaW1lKGNvbXBvbmVudCwgdGFyZ2V0RGF0ZSk7XG4gICAgY29tcG9uZW50LmRlbGV0ZShcIm1lcmlkaWVtXCIpO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvdG9kYXlcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiB5ZXN0ZXJkYXkocmVmZXJlbmNlKSB7XG4gICAgcmV0dXJuIHRoZURheUJlZm9yZShyZWZlcmVuY2UsIDEpLmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS95ZXN0ZXJkYXlcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gdG9tb3Jyb3cocmVmZXJlbmNlKSB7XG4gICAgcmV0dXJuIHRoZURheUFmdGVyKHJlZmVyZW5jZSwgMSkuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL3RvbW9ycm93XCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRoZURheUJlZm9yZShyZWZlcmVuY2UsIG51bURheSkge1xuICAgIHJldHVybiB0aGVEYXlBZnRlcihyZWZlcmVuY2UsIC1udW1EYXkpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIHRoZURheUFmdGVyKHJlZmVyZW5jZSwgbkRheXMpIHtcbiAgICBjb25zdCB0YXJnZXREYXRlID0gcmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBjb25zdCBuZXdEYXRlID0gbmV3IERhdGUodGFyZ2V0RGF0ZS5nZXRUaW1lKCkpO1xuICAgIG5ld0RhdGUuc2V0RGF0ZShuZXdEYXRlLmdldERhdGUoKSArIG5EYXlzKTtcbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIG5ld0RhdGUpO1xuICAgIGltcGx5U2ltaWxhclRpbWUoY29tcG9uZW50LCBuZXdEYXRlKTtcbiAgICBjb21wb25lbnQuZGVsZXRlKFwibWVyaWRpZW1cIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiB0b25pZ2h0KHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gMjIpIHtcbiAgICBjb25zdCB0YXJnZXREYXRlID0gcmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtZXJpZGllbVwiLCBNZXJpZGllbS5QTSk7XG4gICAgY29tcG9uZW50LmFkZFRhZyhcImNhc3VhbFJlZmVyZW5jZS90b25pZ2h0XCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gbGFzdE5pZ2h0KHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gMCkge1xuICAgIGxldCB0YXJnZXREYXRlID0gcmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpO1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBpZiAodGFyZ2V0RGF0ZS5nZXRIb3VycygpIDwgNikge1xuICAgICAgICB0YXJnZXREYXRlID0gbmV3IERhdGUodGFyZ2V0RGF0ZS5nZXRUaW1lKCkgLSAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgICB9XG4gICAgYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJob3VyXCIsIGltcGx5SG91cik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBldmVuaW5nKHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gMjApIHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICBjb21wb25lbnQuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL2V2ZW5pbmdcIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbmV4cG9ydCBmdW5jdGlvbiB5ZXN0ZXJkYXlFdmVuaW5nKHJlZmVyZW5jZSwgaW1wbHlIb3VyID0gMjApIHtcbiAgICBsZXQgdGFyZ2V0RGF0ZSA9IHJlZmVyZW5jZS5nZXREYXRlV2l0aEFkanVzdGVkVGltZXpvbmUoKTtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgdGFyZ2V0RGF0ZSA9IG5ldyBEYXRlKHRhcmdldERhdGUuZ2V0VGltZSgpIC0gMjQgKiA2MCAqIDYwICogMTAwMCk7XG4gICAgYXNzaWduU2ltaWxhckRhdGUoY29tcG9uZW50LCB0YXJnZXREYXRlKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJob3VyXCIsIGltcGx5SG91cik7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uUE0pO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UveWVzdGVyZGF5XCIpO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvZXZlbmluZ1wiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIG1pZG5pZ2h0KHJlZmVyZW5jZSkge1xuICAgIGNvbnN0IGNvbXBvbmVudCA9IG5ldyBQYXJzaW5nQ29tcG9uZW50cyhyZWZlcmVuY2UsIHt9KTtcbiAgICBpZiAocmVmZXJlbmNlLmdldERhdGVXaXRoQWRqdXN0ZWRUaW1lem9uZSgpLmdldEhvdXJzKCkgPiAyKSB7XG4gICAgICAgIGNvbXBvbmVudC5hZGREdXJhdGlvbkFzSW1wbGllZCh7IGRheTogMSB9KTtcbiAgICB9XG4gICAgY29tcG9uZW50LmFzc2lnbihcImhvdXJcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWludXRlXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcInNlY29uZFwiLCAwKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaWxsaXNlY29uZFwiLCAwKTtcbiAgICBjb21wb25lbnQuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL21pZG5pZ2h0XCIpO1xuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5leHBvcnQgZnVuY3Rpb24gbW9ybmluZyhyZWZlcmVuY2UsIGltcGx5SG91ciA9IDYpIHtcbiAgICBjb25zdCBjb21wb25lbnQgPSBuZXcgUGFyc2luZ0NvbXBvbmVudHMocmVmZXJlbmNlLCB7fSk7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWVyaWRpZW1cIiwgTWVyaWRpZW0uQU0pO1xuICAgIGNvbXBvbmVudC5pbXBseShcImhvdXJcIiwgaW1wbHlIb3VyKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaW51dGVcIiwgMCk7XG4gICAgY29tcG9uZW50LmltcGx5KFwic2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIDApO1xuICAgIGNvbXBvbmVudC5hZGRUYWcoXCJjYXN1YWxSZWZlcmVuY2UvbW9ybmluZ1wiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGFmdGVybm9vbihyZWZlcmVuY2UsIGltcGx5SG91ciA9IDE1KSB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLlBNKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJob3VyXCIsIGltcGx5SG91cik7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWludXRlXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcInNlY29uZFwiLCAwKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaWxsaXNlY29uZFwiLCAwKTtcbiAgICBjb21wb25lbnQuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL2FmdGVybm9vblwiKTtcbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuZXhwb3J0IGZ1bmN0aW9uIG5vb24ocmVmZXJlbmNlKSB7XG4gICAgY29uc3QgY29tcG9uZW50ID0gbmV3IFBhcnNpbmdDb21wb25lbnRzKHJlZmVyZW5jZSwge30pO1xuICAgIGNvbXBvbmVudC5pbXBseShcIm1lcmlkaWVtXCIsIE1lcmlkaWVtLkFNKTtcbiAgICBjb21wb25lbnQuYXNzaWduKFwiaG91clwiLCAxMik7XG4gICAgY29tcG9uZW50LmltcGx5KFwibWludXRlXCIsIDApO1xuICAgIGNvbXBvbmVudC5pbXBseShcInNlY29uZFwiLCAwKTtcbiAgICBjb21wb25lbnQuaW1wbHkoXCJtaWxsaXNlY29uZFwiLCAwKTtcbiAgICBjb21wb25lbnQuYWRkVGFnKFwiY2FzdWFsUmVmZXJlbmNlL25vb25cIik7XG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNhc3VhbFJlZmVyZW5jZXMuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBhc3NpZ25TaW1pbGFyRGF0ZSB9IGZyb20gXCIuLi8uLi8uLi91dGlscy9kYXRlcy5qc1wiO1xuaW1wb3J0ICogYXMgcmVmZXJlbmNlcyBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL2Nhc3VhbFJlZmVyZW5jZXMuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSAvKG5vd3x0b2RheXx0b25pZ2h0fHRvbW9ycm93fG92ZXJtb3Jyb3d8dG1yfHRtcnd8eWVzdGVyZGF5fGxhc3RcXHMqbmlnaHQpKD89XFxXfCQpL2k7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTkNhc3VhbERhdGVQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKGNvbnRleHQpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBsZXQgdGFyZ2V0RGF0ZSA9IGNvbnRleHQucmVmRGF0ZTtcbiAgICAgICAgY29uc3QgbG93ZXJUZXh0ID0gbWF0Y2hbMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgbGV0IGNvbXBvbmVudCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoKTtcbiAgICAgICAgc3dpdGNoIChsb3dlclRleHQpIHtcbiAgICAgICAgICAgIGNhc2UgXCJub3dcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSByZWZlcmVuY2VzLm5vdyhjb250ZXh0LnJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwidG9kYXlcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSByZWZlcmVuY2VzLnRvZGF5KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJ5ZXN0ZXJkYXlcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSByZWZlcmVuY2VzLnllc3RlcmRheShjb250ZXh0LnJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwidG9tb3Jyb3dcIjpcbiAgICAgICAgICAgIGNhc2UgXCJ0bXJcIjpcbiAgICAgICAgICAgIGNhc2UgXCJ0bXJ3XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gcmVmZXJlbmNlcy50b21vcnJvdyhjb250ZXh0LnJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwidG9uaWdodFwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMudG9uaWdodChjb250ZXh0LnJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwib3Zlcm1vcnJvd1wiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IHJlZmVyZW5jZXMudGhlRGF5QWZ0ZXIoY29udGV4dC5yZWZlcmVuY2UsIDIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBpZiAobG93ZXJUZXh0Lm1hdGNoKC9sYXN0XFxzKm5pZ2h0LykpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldERhdGUuZ2V0SG91cnMoKSA+IDYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzRGF5ID0gbmV3IERhdGUodGFyZ2V0RGF0ZS5nZXRUaW1lKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlvdXNEYXkuc2V0RGF0ZShwcmV2aW91c0RheS5nZXREYXRlKCkgLSAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldERhdGUgPSBwcmV2aW91c0RheTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBhc3NpZ25TaW1pbGFyRGF0ZShjb21wb25lbnQsIHRhcmdldERhdGUpO1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuaW1wbHkoXCJob3VyXCIsIDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjb21wb25lbnQuYWRkVGFnKFwicGFyc2VyL0VOQ2FzdWFsRGF0ZVBhcnNlclwiKTtcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTkNhc3VhbERhdGVQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgKiBhcyBjYXN1YWxSZWZlcmVuY2VzIGZyb20gXCIuLi8uLi8uLi9jb21tb24vY2FzdWFsUmVmZXJlbmNlcy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IC8oPzp0aGlzKT9cXHN7MCwzfShtb3JuaW5nfGFmdGVybm9vbnxldmVuaW5nfG5pZ2h0fG1pZG5pZ2h0fG1pZGRheXxub29uKSg/PVxcV3wkKS9pO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5DYXN1YWxUaW1lUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBsZXQgY29tcG9uZW50ID0gbnVsbDtcbiAgICAgICAgc3dpdGNoIChtYXRjaFsxXS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICBjYXNlIFwiYWZ0ZXJub29uXCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gY2FzdWFsUmVmZXJlbmNlcy5hZnRlcm5vb24oY29udGV4dC5yZWZlcmVuY2UpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImV2ZW5pbmdcIjpcbiAgICAgICAgICAgIGNhc2UgXCJuaWdodFwiOlxuICAgICAgICAgICAgICAgIGNvbXBvbmVudCA9IGNhc3VhbFJlZmVyZW5jZXMuZXZlbmluZyhjb250ZXh0LnJlZmVyZW5jZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwibWlkbmlnaHRcIjpcbiAgICAgICAgICAgICAgICBjb21wb25lbnQgPSBjYXN1YWxSZWZlcmVuY2VzLm1pZG5pZ2h0KGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJtb3JuaW5nXCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gY2FzdWFsUmVmZXJlbmNlcy5tb3JuaW5nKGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJub29uXCI6XG4gICAgICAgICAgICBjYXNlIFwibWlkZGF5XCI6XG4gICAgICAgICAgICAgICAgY29tcG9uZW50ID0gY2FzdWFsUmVmZXJlbmNlcy5ub29uKGNvbnRleHQucmVmZXJlbmNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICBjb21wb25lbnQuYWRkVGFnKFwicGFyc2VyL0VOQ2FzdWFsVGltZVBhcnNlclwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOQ2FzdWFsVGltZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBXRUVLREFZX0RJQ1RJT05BUlkgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBtYXRjaEFueVBhdHRlcm4gfSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvcGF0dGVybi5qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBjcmVhdGVQYXJzaW5nQ29tcG9uZW50c0F0V2Vla2RheSB9IGZyb20gXCIuLi8uLi8uLi9jYWxjdWxhdGlvbi93ZWVrZGF5cy5qc1wiO1xuaW1wb3J0IHsgV2Vla2RheSB9IGZyb20gXCIuLi8uLi8uLi90eXBlcy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoPzooPzpcXFxcLHxcXFxcKHxcXFxc77yIKVxcXFxzKik/XCIgK1xuICAgIFwiKD86b25cXFxccyo/KT9cIiArXG4gICAgXCIoPzoodGhpc3xsYXN0fHBhc3R8bmV4dClcXFxccyopP1wiICtcbiAgICBgKCR7bWF0Y2hBbnlQYXR0ZXJuKFdFRUtEQVlfRElDVElPTkFSWSl9fHdlZWtlbmR8d2Vla2RheSlgICtcbiAgICBcIig/OlxcXFxzKig/OlxcXFwsfFxcXFwpfFxcXFzvvIkpKT9cIiArXG4gICAgXCIoPzpcXFxccyooPzpvZlxcXFxzKik/KHRoaXN8bGFzdHxwYXN0fG5leHQpXFxcXHMqd2Vlayk/XCIgK1xuICAgIFwiKD89XFxcXFd8JClcIiwgXCJpXCIpO1xuY29uc3QgUFJFRklYX0dST1VQID0gMTtcbmNvbnN0IFdFRUtEQVlfR1JPVVAgPSAyO1xuY29uc3QgUE9TVEZJWF9HUk9VUCA9IDM7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTldlZWtkYXlQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHByZWZpeCA9IG1hdGNoW1BSRUZJWF9HUk9VUF07XG4gICAgICAgIGNvbnN0IHBvc3RmaXggPSBtYXRjaFtQT1NURklYX0dST1VQXTtcbiAgICAgICAgbGV0IG1vZGlmaWVyV29yZCA9IHByZWZpeCB8fCBwb3N0Zml4O1xuICAgICAgICBtb2RpZmllcldvcmQgPSBtb2RpZmllcldvcmQgfHwgXCJcIjtcbiAgICAgICAgbW9kaWZpZXJXb3JkID0gbW9kaWZpZXJXb3JkLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGxldCBtb2RpZmllciA9IG51bGw7XG4gICAgICAgIGlmIChtb2RpZmllcldvcmQgPT0gXCJsYXN0XCIgfHwgbW9kaWZpZXJXb3JkID09IFwicGFzdFwiKSB7XG4gICAgICAgICAgICBtb2RpZmllciA9IFwibGFzdFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1vZGlmaWVyV29yZCA9PSBcIm5leHRcIikge1xuICAgICAgICAgICAgbW9kaWZpZXIgPSBcIm5leHRcIjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtb2RpZmllcldvcmQgPT0gXCJ0aGlzXCIpIHtcbiAgICAgICAgICAgIG1vZGlmaWVyID0gXCJ0aGlzXCI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgd2Vla2RheV93b3JkID0gbWF0Y2hbV0VFS0RBWV9HUk9VUF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgbGV0IHdlZWtkYXk7XG4gICAgICAgIGlmIChXRUVLREFZX0RJQ1RJT05BUllbd2Vla2RheV93b3JkXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB3ZWVrZGF5ID0gV0VFS0RBWV9ESUNUSU9OQVJZW3dlZWtkYXlfd29yZF07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAod2Vla2RheV93b3JkID09IFwid2Vla2VuZFwiKSB7XG4gICAgICAgICAgICB3ZWVrZGF5ID0gbW9kaWZpZXIgPT0gXCJsYXN0XCIgPyBXZWVrZGF5LlNVTkRBWSA6IFdlZWtkYXkuU0FUVVJEQVk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAod2Vla2RheV93b3JkID09IFwid2Vla2RheVwiKSB7XG4gICAgICAgICAgICBjb25zdCByZWZXZWVrZGF5ID0gY29udGV4dC5yZWZlcmVuY2UuZ2V0RGF0ZVdpdGhBZGp1c3RlZFRpbWV6b25lKCkuZ2V0RGF5KCk7XG4gICAgICAgICAgICBpZiAocmVmV2Vla2RheSA9PSBXZWVrZGF5LlNVTkRBWSB8fCByZWZXZWVrZGF5ID09IFdlZWtkYXkuU0FUVVJEQVkpIHtcbiAgICAgICAgICAgICAgICB3ZWVrZGF5ID0gbW9kaWZpZXIgPT0gXCJsYXN0XCIgPyBXZWVrZGF5LkZSSURBWSA6IFdlZWtkYXkuTU9OREFZO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgd2Vla2RheSA9IHJlZldlZWtkYXkgLSAxO1xuICAgICAgICAgICAgICAgIHdlZWtkYXkgPSBtb2RpZmllciA9PSBcImxhc3RcIiA/IHdlZWtkYXkgLSAxIDogd2Vla2RheSArIDE7XG4gICAgICAgICAgICAgICAgd2Vla2RheSA9ICh3ZWVrZGF5ICUgNSkgKyAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNyZWF0ZVBhcnNpbmdDb21wb25lbnRzQXRXZWVrZGF5KGNvbnRleHQucmVmZXJlbmNlLCB3ZWVrZGF5LCBtb2RpZmllcik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5XZWVrZGF5UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IFRJTUVfVU5JVF9ESUNUSU9OQVJZIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgUGFyc2luZ0NvbXBvbmVudHMgfSBmcm9tIFwiLi4vLi4vLi4vcmVzdWx0cy5qc1wiO1xuaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBtYXRjaEFueVBhdHRlcm4gfSBmcm9tIFwiLi4vLi4vLi4vdXRpbHMvcGF0dGVybi5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCh0aGlzfGxhc3R8cGFzdHxuZXh0fGFmdGVyXFxcXHMqdGhpcylcXFxccyooJHttYXRjaEFueVBhdHRlcm4oVElNRV9VTklUX0RJQ1RJT05BUlkpfSkoPz1cXFxccyopYCArIFwiKD89XFxcXFd8JClcIiwgXCJpXCIpO1xuY29uc3QgTU9ESUZJRVJfV09SRF9HUk9VUCA9IDE7XG5jb25zdCBSRUxBVElWRV9XT1JEX0dST1VQID0gMjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOUmVsYXRpdmVEYXRlRm9ybWF0UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIFBBVFRFUk47XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCBtb2RpZmllciA9IG1hdGNoW01PRElGSUVSX1dPUkRfR1JPVVBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGNvbnN0IHVuaXRXb3JkID0gbWF0Y2hbUkVMQVRJVkVfV09SRF9HUk9VUF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgdGltZXVuaXQgPSBUSU1FX1VOSVRfRElDVElPTkFSWVt1bml0V29yZF07XG4gICAgICAgIGlmIChtb2RpZmllciA9PSBcIm5leHRcIiB8fCBtb2RpZmllci5zdGFydHNXaXRoKFwiYWZ0ZXJcIikpIHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVVbml0cyA9IHt9O1xuICAgICAgICAgICAgdGltZVVuaXRzW3RpbWV1bml0XSA9IDE7XG4gICAgICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCB0aW1lVW5pdHMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtb2RpZmllciA9PSBcImxhc3RcIiB8fCBtb2RpZmllciA9PSBcInBhc3RcIikge1xuICAgICAgICAgICAgY29uc3QgdGltZVVuaXRzID0ge307XG4gICAgICAgICAgICB0aW1lVW5pdHNbdGltZXVuaXRdID0gLTE7XG4gICAgICAgICAgICByZXR1cm4gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKGNvbnRleHQucmVmZXJlbmNlLCB0aW1lVW5pdHMpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdDb21wb25lbnRzKCk7XG4gICAgICAgIGxldCBkYXRlID0gbmV3IERhdGUoY29udGV4dC5yZWZlcmVuY2UuaW5zdGFudC5nZXRUaW1lKCkpO1xuICAgICAgICBpZiAodW5pdFdvcmQubWF0Y2goL3dlZWsvaSkpIHtcbiAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSAtIGRhdGUuZ2V0RGF5KCkpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaXRXb3JkLm1hdGNoKC9tb250aC9pKSkge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKDEpO1xuICAgICAgICAgICAgY29tcG9uZW50cy5pbXBseShcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodW5pdFdvcmQubWF0Y2goL3llYXIvaSkpIHtcbiAgICAgICAgICAgIGRhdGUuc2V0RGF0ZSgxKTtcbiAgICAgICAgICAgIGRhdGUuc2V0TW9udGgoMCk7XG4gICAgICAgICAgICBjb21wb25lbnRzLmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuaW1wbHkoXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIGNvbXBvbmVudHMuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb21wb25lbnRzO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOUmVsYXRpdmVEYXRlRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IGZpbmRNb3N0TGlrZWx5QURZZWFyLCBmaW5kWWVhckNsb3Nlc3RUb1JlZiB9IGZyb20gXCIuLi8uLi9jYWxjdWxhdGlvbi95ZWFycy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoW15cXFxcZF18XilcIiArXG4gICAgXCIoWzAtM117MCwxfVswLTldezF9KVtcXFxcL1xcXFwuXFxcXC1dKFswLTNdezAsMX1bMC05XXsxfSlcIiArXG4gICAgXCIoPzpbXFxcXC9cXFxcLlxcXFwtXShbMC05XXs0fXxbMC05XXsyfSkpP1wiICtcbiAgICBcIihcXFxcV3wkKVwiLCBcImlcIik7XG5jb25zdCBPUEVOSU5HX0dST1VQID0gMTtcbmNvbnN0IEVORElOR19HUk9VUCA9IDU7XG5jb25zdCBGSVJTVF9OVU1CRVJTX0dST1VQID0gMjtcbmNvbnN0IFNFQ09ORF9OVU1CRVJTX0dST1VQID0gMztcbmNvbnN0IFlFQVJfR1JPVVAgPSA0O1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU2xhc2hEYXRlRm9ybWF0UGFyc2VyIHtcbiAgICBncm91cE51bWJlck1vbnRoO1xuICAgIGdyb3VwTnVtYmVyRGF5O1xuICAgIGNvbnN0cnVjdG9yKGxpdHRsZUVuZGlhbikge1xuICAgICAgICB0aGlzLmdyb3VwTnVtYmVyTW9udGggPSBsaXR0bGVFbmRpYW4gPyBTRUNPTkRfTlVNQkVSU19HUk9VUCA6IEZJUlNUX05VTUJFUlNfR1JPVVA7XG4gICAgICAgIHRoaXMuZ3JvdXBOdW1iZXJEYXkgPSBsaXR0bGVFbmRpYW4gPyBGSVJTVF9OVU1CRVJTX0dST1VQIDogU0VDT05EX05VTUJFUlNfR1JPVVA7XG4gICAgfVxuICAgIHBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBleHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gbWF0Y2guaW5kZXggKyBtYXRjaFtPUEVOSU5HX0dST1VQXS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGluZGV4RW5kID0gbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGggLSBtYXRjaFtFTkRJTkdfR1JPVVBdLmxlbmd0aDtcbiAgICAgICAgaWYgKGluZGV4ID4gMCkge1xuICAgICAgICAgICAgY29uc3QgdGV4dEJlZm9yZSA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcoMCwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKHRleHRCZWZvcmUubWF0Y2goXCJcXFxcZC8/JFwiKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoaW5kZXhFbmQgPCBjb250ZXh0LnRleHQubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0QWZ0ZXIgPSBjb250ZXh0LnRleHQuc3Vic3RyaW5nKGluZGV4RW5kKTtcbiAgICAgICAgICAgIGlmICh0ZXh0QWZ0ZXIubWF0Y2goXCJeLz9cXFxcZFwiKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0ZXh0ID0gY29udGV4dC50ZXh0LnN1YnN0cmluZyhpbmRleCwgaW5kZXhFbmQpO1xuICAgICAgICBpZiAodGV4dC5tYXRjaCgvXlxcZFxcLlxcZCQvKSB8fCB0ZXh0Lm1hdGNoKC9eXFxkXFwuXFxkezEsMn1cXC5cXGR7MSwyfVxccyokLykpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1hdGNoW1lFQVJfR1JPVVBdICYmIHRleHQuaW5kZXhPZihcIi9cIikgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KGluZGV4LCB0ZXh0KTtcbiAgICAgICAgbGV0IG1vbnRoID0gcGFyc2VJbnQobWF0Y2hbdGhpcy5ncm91cE51bWJlck1vbnRoXSk7XG4gICAgICAgIGxldCBkYXkgPSBwYXJzZUludChtYXRjaFt0aGlzLmdyb3VwTnVtYmVyRGF5XSk7XG4gICAgICAgIGlmIChtb250aCA8IDEgfHwgbW9udGggPiAxMikge1xuICAgICAgICAgICAgaWYgKG1vbnRoID4gMTIpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGF5ID49IDEgJiYgZGF5IDw9IDEyICYmIG1vbnRoIDw9IDMxKSB7XG4gICAgICAgICAgICAgICAgICAgIFtkYXksIG1vbnRoXSA9IFttb250aCwgZGF5XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF5IDwgMSB8fCBkYXkgPiAzMSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXkpO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgbW9udGgpO1xuICAgICAgICBpZiAobWF0Y2hbWUVBUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGNvbnN0IHJhd1llYXJOdW1iZXIgPSBwYXJzZUludChtYXRjaFtZRUFSX0dST1VQXSk7XG4gICAgICAgICAgICBjb25zdCB5ZWFyID0gZmluZE1vc3RMaWtlbHlBRFllYXIocmF3WWVhck51bWJlcik7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBmaW5kWWVhckNsb3Nlc3RUb1JlZihjb250ZXh0LnJlZkRhdGUsIGRheSwgbW9udGgpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0LmFkZFRhZyhcInBhcnNlci9TbGFzaERhdGVGb3JtYXRQYXJzZXJcIik7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9U2xhc2hEYXRlRm9ybWF0UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IFRJTUVfVU5JVFNfUEFUVEVSTiwgcGFyc2VEdXJhdGlvbiwgVElNRV9VTklUU19OT19BQkJSX1BBVFRFUk4gfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nQ29tcG9uZW50cyB9IGZyb20gXCIuLi8uLi8uLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vcGFyc2Vycy9BYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnkuanNcIjtcbmltcG9ydCB7IHJldmVyc2VEdXJhdGlvbiB9IGZyb20gXCIuLi8uLi8uLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoYCh0aGlzfGxhc3R8cGFzdHxuZXh0fGFmdGVyfFxcXFwrfC0pXFxcXHMqKCR7VElNRV9VTklUU19QQVRURVJOfSkoPz1cXFxcV3wkKWAsIFwiaVwiKTtcbmNvbnN0IFBBVFRFUk5fTk9fQUJCUiA9IG5ldyBSZWdFeHAoYCh0aGlzfGxhc3R8cGFzdHxuZXh0fGFmdGVyfFxcXFwrfC0pXFxcXHMqKCR7VElNRV9VTklUU19OT19BQkJSX1BBVFRFUk59KSg/PVxcXFxXfCQpYCwgXCJpXCIpO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5UaW1lVW5pdENhc3VhbFJlbGF0aXZlRm9ybWF0UGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIGFsbG93QWJicmV2aWF0aW9ucztcbiAgICBjb25zdHJ1Y3RvcihhbGxvd0FiYnJldmlhdGlvbnMgPSB0cnVlKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuYWxsb3dBYmJyZXZpYXRpb25zID0gYWxsb3dBYmJyZXZpYXRpb25zO1xuICAgIH1cbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFsbG93QWJicmV2aWF0aW9ucyA/IFBBVFRFUk4gOiBQQVRURVJOX05PX0FCQlI7XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCBwcmVmaXggPSBtYXRjaFsxXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBsZXQgZHVyYXRpb24gPSBwYXJzZUR1cmF0aW9uKG1hdGNoWzJdKTtcbiAgICAgICAgaWYgKCFkdXJhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoIChwcmVmaXgpIHtcbiAgICAgICAgICAgIGNhc2UgXCJsYXN0XCI6XG4gICAgICAgICAgICBjYXNlIFwicGFzdFwiOlxuICAgICAgICAgICAgY2FzZSBcIi1cIjpcbiAgICAgICAgICAgICAgICBkdXJhdGlvbiA9IHJldmVyc2VEdXJhdGlvbihkdXJhdGlvbik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFBhcnNpbmdDb21wb25lbnRzLmNyZWF0ZVJlbGF0aXZlRnJvbVJlZmVyZW5jZShjb250ZXh0LnJlZmVyZW5jZSwgZHVyYXRpb24pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOVGltZVVuaXRDYXN1YWxSZWxhdGl2ZUZvcm1hdFBhcnNlci5qcy5tYXAiLCJpbXBvcnQgeyBNZXJnaW5nUmVmaW5lciB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vYWJzdHJhY3RSZWZpbmVycy5qc1wiO1xuaW1wb3J0IHsgUGFyc2luZ0NvbXBvbmVudHMsIFBhcnNpbmdSZXN1bHQsIFJlZmVyZW5jZVdpdGhUaW1lem9uZSB9IGZyb20gXCIuLi8uLi8uLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBwYXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgcmV2ZXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5mdW5jdGlvbiBJc1Bvc2l0aXZlRm9sbG93aW5nUmVmZXJlbmNlKHJlc3VsdCkge1xuICAgIHJldHVybiByZXN1bHQudGV4dC5tYXRjaCgvXlsrLV0vaSkgIT0gbnVsbDtcbn1cbmZ1bmN0aW9uIElzTmVnYXRpdmVGb2xsb3dpbmdSZWZlcmVuY2UocmVzdWx0KSB7XG4gICAgcmV0dXJuIHJlc3VsdC50ZXh0Lm1hdGNoKC9eLS9pKSAhPSBudWxsO1xufVxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRU5NZXJnZVJlbGF0aXZlQWZ0ZXJEYXRlUmVmaW5lciBleHRlbmRzIE1lcmdpbmdSZWZpbmVyIHtcbiAgICBzaG91bGRNZXJnZVJlc3VsdHModGV4dEJldHdlZW4sIGN1cnJlbnRSZXN1bHQsIG5leHRSZXN1bHQpIHtcbiAgICAgICAgaWYgKCF0ZXh0QmV0d2Vlbi5tYXRjaCgvXlxccyokL2kpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIElzUG9zaXRpdmVGb2xsb3dpbmdSZWZlcmVuY2UobmV4dFJlc3VsdCkgfHwgSXNOZWdhdGl2ZUZvbGxvd2luZ1JlZmVyZW5jZShuZXh0UmVzdWx0KTtcbiAgICB9XG4gICAgbWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0LCBjb250ZXh0KSB7XG4gICAgICAgIGxldCB0aW1lVW5pdHMgPSBwYXJzZUR1cmF0aW9uKG5leHRSZXN1bHQudGV4dCk7XG4gICAgICAgIGlmIChJc05lZ2F0aXZlRm9sbG93aW5nUmVmZXJlbmNlKG5leHRSZXN1bHQpKSB7XG4gICAgICAgICAgICB0aW1lVW5pdHMgPSByZXZlcnNlRHVyYXRpb24odGltZVVuaXRzKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gUGFyc2luZ0NvbXBvbmVudHMuY3JlYXRlUmVsYXRpdmVGcm9tUmVmZXJlbmNlKFJlZmVyZW5jZVdpdGhUaW1lem9uZS5mcm9tRGF0ZShjdXJyZW50UmVzdWx0LnN0YXJ0LmRhdGUoKSksIHRpbWVVbml0cyk7XG4gICAgICAgIHJldHVybiBuZXcgUGFyc2luZ1Jlc3VsdChjdXJyZW50UmVzdWx0LnJlZmVyZW5jZSwgY3VycmVudFJlc3VsdC5pbmRleCwgYCR7Y3VycmVudFJlc3VsdC50ZXh0fSR7dGV4dEJldHdlZW59JHtuZXh0UmVzdWx0LnRleHR9YCwgY29tcG9uZW50cyk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9RU5NZXJnZVJlbGF0aXZlQWZ0ZXJEYXRlUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgeyBNZXJnaW5nUmVmaW5lciB9IGZyb20gXCIuLi8uLi8uLi9jb21tb24vYWJzdHJhY3RSZWZpbmVycy5qc1wiO1xuaW1wb3J0IHsgUGFyc2luZ0NvbXBvbmVudHMsIFBhcnNpbmdSZXN1bHQsIFJlZmVyZW5jZVdpdGhUaW1lem9uZSB9IGZyb20gXCIuLi8uLi8uLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgeyBwYXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgcmV2ZXJzZUR1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uL2NhbGN1bGF0aW9uL2R1cmF0aW9uLmpzXCI7XG5mdW5jdGlvbiBoYXNJbXBsaWVkRWFybGllclJlZmVyZW5jZURhdGUocmVzdWx0KSB7XG4gICAgcmV0dXJuIHJlc3VsdC50ZXh0Lm1hdGNoKC9cXHMrKGJlZm9yZXxmcm9tKSQvaSkgIT0gbnVsbDtcbn1cbmZ1bmN0aW9uIGhhc0ltcGxpZWRMYXRlclJlZmVyZW5jZURhdGUocmVzdWx0KSB7XG4gICAgcmV0dXJuIHJlc3VsdC50ZXh0Lm1hdGNoKC9cXHMrKGFmdGVyfHNpbmNlKSQvaSkgIT0gbnVsbDtcbn1cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOTWVyZ2VSZWxhdGl2ZUZvbGxvd0J5RGF0ZVJlZmluZXIgZXh0ZW5kcyBNZXJnaW5nUmVmaW5lciB7XG4gICAgcGF0dGVybkJldHdlZW4oKSB7XG4gICAgICAgIHJldHVybiAvXlxccyokL2k7XG4gICAgfVxuICAgIHNob3VsZE1lcmdlUmVzdWx0cyh0ZXh0QmV0d2VlbiwgY3VycmVudFJlc3VsdCwgbmV4dFJlc3VsdCkge1xuICAgICAgICBpZiAoIXRleHRCZXR3ZWVuLm1hdGNoKHRoaXMucGF0dGVybkJldHdlZW4oKSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWhhc0ltcGxpZWRFYXJsaWVyUmVmZXJlbmNlRGF0ZShjdXJyZW50UmVzdWx0KSAmJiAhaGFzSW1wbGllZExhdGVyUmVmZXJlbmNlRGF0ZShjdXJyZW50UmVzdWx0KSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAhIW5leHRSZXN1bHQuc3RhcnQuZ2V0KFwiZGF5XCIpICYmICEhbmV4dFJlc3VsdC5zdGFydC5nZXQoXCJtb250aFwiKSAmJiAhIW5leHRSZXN1bHQuc3RhcnQuZ2V0KFwieWVhclwiKTtcbiAgICB9XG4gICAgbWVyZ2VSZXN1bHRzKHRleHRCZXR3ZWVuLCBjdXJyZW50UmVzdWx0LCBuZXh0UmVzdWx0KSB7XG4gICAgICAgIGxldCBkdXJhdGlvbiA9IHBhcnNlRHVyYXRpb24oY3VycmVudFJlc3VsdC50ZXh0KTtcbiAgICAgICAgaWYgKGhhc0ltcGxpZWRFYXJsaWVyUmVmZXJlbmNlRGF0ZShjdXJyZW50UmVzdWx0KSkge1xuICAgICAgICAgICAgZHVyYXRpb24gPSByZXZlcnNlRHVyYXRpb24oZHVyYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBQYXJzaW5nQ29tcG9uZW50cy5jcmVhdGVSZWxhdGl2ZUZyb21SZWZlcmVuY2UoUmVmZXJlbmNlV2l0aFRpbWV6b25lLmZyb21EYXRlKG5leHRSZXN1bHQuc3RhcnQuZGF0ZSgpKSwgZHVyYXRpb24pO1xuICAgICAgICByZXR1cm4gbmV3IFBhcnNpbmdSZXN1bHQobmV4dFJlc3VsdC5yZWZlcmVuY2UsIGN1cnJlbnRSZXN1bHQuaW5kZXgsIGAke2N1cnJlbnRSZXN1bHQudGV4dH0ke3RleHRCZXR3ZWVufSR7bmV4dFJlc3VsdC50ZXh0fWAsIGNvbXBvbmVudHMpO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVOTWVyZ2VSZWxhdGl2ZUZvbGxvd0J5RGF0ZVJlZmluZXIuanMubWFwIiwiaW1wb3J0IHsgWUVBUl9QQVRURVJOLCBwYXJzZVllYXIgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5jb25zdCBZRUFSX1NVRkZJWF9QQVRURVJOID0gbmV3IFJlZ0V4cChgXlxcXFxzKigke1lFQVJfUEFUVEVSTn0pYCwgXCJpXCIpO1xuY29uc3QgWUVBUl9HUk9VUCA9IDE7XG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lciB7XG4gICAgcmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpIHtcbiAgICAgICAgcmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgIGlmICghcmVzdWx0LnN0YXJ0LmlzRGF0ZVdpdGhVbmtub3duWWVhcigpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc3VmZml4ID0gY29udGV4dC50ZXh0LnN1YnN0cmluZyhyZXN1bHQuaW5kZXggKyByZXN1bHQudGV4dC5sZW5ndGgpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBZRUFSX1NVRkZJWF9QQVRURVJOLmV4ZWMoc3VmZml4KTtcbiAgICAgICAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWF0Y2hbMF0udHJpbSgpLmxlbmd0aCA8PSAzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEV4dHJhY3RpbmcgeWVhcjogJyR7bWF0Y2hbMF19JyBpbnRvIDogJHtyZXN1bHR9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IHllYXIgPSBwYXJzZVllYXIobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5lbmQgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwieWVhclwiLCB5ZWFyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIHllYXIpO1xuICAgICAgICAgICAgcmVzdWx0LnRleHQgKz0gbWF0Y2hbMF07XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTkV4dHJhY3RZZWFyU3VmZml4UmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgeyBGaWx0ZXIgfSBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL2Fic3RyYWN0UmVmaW5lcnMuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVOVW5saWtlbHlGb3JtYXRGaWx0ZXIgZXh0ZW5kcyBGaWx0ZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgIH1cbiAgICBpc1ZhbGlkKGNvbnRleHQsIHJlc3VsdCkge1xuICAgICAgICBjb25zdCB0ZXh0ID0gcmVzdWx0LnRleHQudHJpbSgpO1xuICAgICAgICBpZiAodGV4dCA9PT0gY29udGV4dC50ZXh0LnRyaW0oKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRleHQudG9Mb3dlckNhc2UoKSA9PT0gXCJtYXlcIikge1xuICAgICAgICAgICAgY29uc3QgdGV4dEJlZm9yZSA9IGNvbnRleHQudGV4dC5zdWJzdHJpbmcoMCwgcmVzdWx0LmluZGV4KS50cmltKCk7XG4gICAgICAgICAgICBpZiAoIXRleHRCZWZvcmUubWF0Y2goL1xcYihpbikkL2kpKSB7XG4gICAgICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBSZW1vdmluZyB1bmxpa2VseSByZXN1bHQ6ICR7cmVzdWx0fWApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGV4dC50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKFwidGhlIHNlY29uZFwiKSkge1xuICAgICAgICAgICAgY29uc3QgdGV4dEFmdGVyID0gY29udGV4dC50ZXh0LnN1YnN0cmluZyhyZXN1bHQuaW5kZXggKyByZXN1bHQudGV4dC5sZW5ndGgpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICh0ZXh0QWZ0ZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnRleHQuZGVidWcoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVtb3ZpbmcgdW5saWtlbHkgcmVzdWx0OiAke3Jlc3VsdH1gKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1FTlVubGlrZWx5Rm9ybWF0RmlsdGVyLmpzLm1hcCIsImltcG9ydCBFTlRpbWVVbml0V2l0aGluRm9ybWF0UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5UaW1lVW5pdFdpdGhpbkZvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IEVOTW9udGhOYW1lTGl0dGxlRW5kaWFuUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5Nb250aE5hbWVMaXR0bGVFbmRpYW5QYXJzZXIuanNcIjtcbmltcG9ydCBFTk1vbnRoTmFtZU1pZGRsZUVuZGlhblBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL0VOTW9udGhOYW1lTWlkZGxlRW5kaWFuUGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5Nb250aE5hbWVQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTk1vbnRoTmFtZVBhcnNlci5qc1wiO1xuaW1wb3J0IEVOWWVhck1vbnRoRGF5UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5ZZWFyTW9udGhEYXlQYXJzZXIuanNcIjtcbmltcG9ydCBFTlNsYXNoTW9udGhGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlNsYXNoTW9udGhGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBFTlRpbWVFeHByZXNzaW9uUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5UaW1lRXhwcmVzc2lvblBhcnNlci5qc1wiO1xuaW1wb3J0IEVOVGltZVVuaXRBZ29Gb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlRpbWVVbml0QWdvRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5UaW1lVW5pdExhdGVyRm9ybWF0UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5UaW1lVW5pdExhdGVyRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5NZXJnZURhdGVSYW5nZVJlZmluZXIgZnJvbSBcIi4vcmVmaW5lcnMvRU5NZXJnZURhdGVSYW5nZVJlZmluZXIuanNcIjtcbmltcG9ydCBFTk1lcmdlRGF0ZVRpbWVSZWZpbmVyIGZyb20gXCIuL3JlZmluZXJzL0VOTWVyZ2VEYXRlVGltZVJlZmluZXIuanNcIjtcbmltcG9ydCB7IGluY2x1ZGVDb21tb25Db25maWd1cmF0aW9uIH0gZnJvbSBcIi4uLy4uL2NvbmZpZ3VyYXRpb25zLmpzXCI7XG5pbXBvcnQgRU5DYXN1YWxEYXRlUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5DYXN1YWxEYXRlUGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5DYXN1YWxUaW1lUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5DYXN1YWxUaW1lUGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5XZWVrZGF5UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5XZWVrZGF5UGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5SZWxhdGl2ZURhdGVGb3JtYXRQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9FTlJlbGF0aXZlRGF0ZUZvcm1hdFBhcnNlci5qc1wiO1xuaW1wb3J0IFNsYXNoRGF0ZUZvcm1hdFBhcnNlciBmcm9tIFwiLi4vLi4vY29tbW9uL3BhcnNlcnMvU2xhc2hEYXRlRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5UaW1lVW5pdENhc3VhbFJlbGF0aXZlRm9ybWF0UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvRU5UaW1lVW5pdENhc3VhbFJlbGF0aXZlRm9ybWF0UGFyc2VyLmpzXCI7XG5pbXBvcnQgRU5NZXJnZVJlbGF0aXZlQWZ0ZXJEYXRlUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9FTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyLmpzXCI7XG5pbXBvcnQgRU5NZXJnZVJlbGF0aXZlRm9sbG93QnlEYXRlUmVmaW5lciBmcm9tIFwiLi9yZWZpbmVycy9FTk1lcmdlUmVsYXRpdmVGb2xsb3dCeURhdGVSZWZpbmVyLmpzXCI7XG5pbXBvcnQgT3ZlcmxhcFJlbW92YWxSZWZpbmVyIGZyb20gXCIuLi8uLi9jb21tb24vcmVmaW5lcnMvT3ZlcmxhcFJlbW92YWxSZWZpbmVyLmpzXCI7XG5pbXBvcnQgRU5FeHRyYWN0WWVhclN1ZmZpeFJlZmluZXIgZnJvbSBcIi4vcmVmaW5lcnMvRU5FeHRyYWN0WWVhclN1ZmZpeFJlZmluZXIuanNcIjtcbmltcG9ydCBFTlVubGlrZWx5Rm9ybWF0RmlsdGVyIGZyb20gXCIuL3JlZmluZXJzL0VOVW5saWtlbHlGb3JtYXRGaWx0ZXIuanNcIjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEVORGVmYXVsdENvbmZpZ3VyYXRpb24ge1xuICAgIGNyZWF0ZUNhc3VhbENvbmZpZ3VyYXRpb24obGl0dGxlRW5kaWFuID0gZmFsc2UpIHtcbiAgICAgICAgY29uc3Qgb3B0aW9uID0gdGhpcy5jcmVhdGVDb25maWd1cmF0aW9uKGZhbHNlLCBsaXR0bGVFbmRpYW4pO1xuICAgICAgICBvcHRpb24ucGFyc2Vycy5wdXNoKG5ldyBFTkNhc3VhbERhdGVQYXJzZXIoKSk7XG4gICAgICAgIG9wdGlvbi5wYXJzZXJzLnB1c2gobmV3IEVOQ2FzdWFsVGltZVBhcnNlcigpKTtcbiAgICAgICAgb3B0aW9uLnBhcnNlcnMucHVzaChuZXcgRU5Nb250aE5hbWVQYXJzZXIoKSk7XG4gICAgICAgIG9wdGlvbi5wYXJzZXJzLnB1c2gobmV3IEVOUmVsYXRpdmVEYXRlRm9ybWF0UGFyc2VyKCkpO1xuICAgICAgICBvcHRpb24ucGFyc2Vycy5wdXNoKG5ldyBFTlRpbWVVbml0Q2FzdWFsUmVsYXRpdmVGb3JtYXRQYXJzZXIoKSk7XG4gICAgICAgIG9wdGlvbi5yZWZpbmVycy5wdXNoKG5ldyBFTlVubGlrZWx5Rm9ybWF0RmlsdGVyKCkpO1xuICAgICAgICByZXR1cm4gb3B0aW9uO1xuICAgIH1cbiAgICBjcmVhdGVDb25maWd1cmF0aW9uKHN0cmljdE1vZGUgPSB0cnVlLCBsaXR0bGVFbmRpYW4gPSBmYWxzZSkge1xuICAgICAgICBjb25zdCBvcHRpb25zID0gaW5jbHVkZUNvbW1vbkNvbmZpZ3VyYXRpb24oe1xuICAgICAgICAgICAgcGFyc2VyczogW1xuICAgICAgICAgICAgICAgIG5ldyBTbGFzaERhdGVGb3JtYXRQYXJzZXIobGl0dGxlRW5kaWFuKSxcbiAgICAgICAgICAgICAgICBuZXcgRU5UaW1lVW5pdFdpdGhpbkZvcm1hdFBhcnNlcihzdHJpY3RNb2RlKSxcbiAgICAgICAgICAgICAgICBuZXcgRU5Nb250aE5hbWVMaXR0bGVFbmRpYW5QYXJzZXIoKSxcbiAgICAgICAgICAgICAgICBuZXcgRU5Nb250aE5hbWVNaWRkbGVFbmRpYW5QYXJzZXIobGl0dGxlRW5kaWFuKSxcbiAgICAgICAgICAgICAgICBuZXcgRU5XZWVrZGF5UGFyc2VyKCksXG4gICAgICAgICAgICAgICAgbmV3IEVOU2xhc2hNb250aEZvcm1hdFBhcnNlcigpLFxuICAgICAgICAgICAgICAgIG5ldyBFTlRpbWVFeHByZXNzaW9uUGFyc2VyKHN0cmljdE1vZGUpLFxuICAgICAgICAgICAgICAgIG5ldyBFTlRpbWVVbml0QWdvRm9ybWF0UGFyc2VyKHN0cmljdE1vZGUpLFxuICAgICAgICAgICAgICAgIG5ldyBFTlRpbWVVbml0TGF0ZXJGb3JtYXRQYXJzZXIoc3RyaWN0TW9kZSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgcmVmaW5lcnM6IFtuZXcgRU5NZXJnZURhdGVUaW1lUmVmaW5lcigpXSxcbiAgICAgICAgfSwgc3RyaWN0TW9kZSk7XG4gICAgICAgIG9wdGlvbnMucGFyc2Vycy51bnNoaWZ0KG5ldyBFTlllYXJNb250aERheVBhcnNlcihzdHJpY3RNb2RlKSk7XG4gICAgICAgIG9wdGlvbnMucmVmaW5lcnMudW5zaGlmdChuZXcgRU5NZXJnZVJlbGF0aXZlRm9sbG93QnlEYXRlUmVmaW5lcigpKTtcbiAgICAgICAgb3B0aW9ucy5yZWZpbmVycy51bnNoaWZ0KG5ldyBFTk1lcmdlUmVsYXRpdmVBZnRlckRhdGVSZWZpbmVyKCkpO1xuICAgICAgICBvcHRpb25zLnJlZmluZXJzLnVuc2hpZnQobmV3IE92ZXJsYXBSZW1vdmFsUmVmaW5lcigpKTtcbiAgICAgICAgb3B0aW9ucy5yZWZpbmVycy5wdXNoKG5ldyBFTk1lcmdlRGF0ZVRpbWVSZWZpbmVyKCkpO1xuICAgICAgICBvcHRpb25zLnJlZmluZXJzLnB1c2gobmV3IEVORXh0cmFjdFllYXJTdWZmaXhSZWZpbmVyKCkpO1xuICAgICAgICBvcHRpb25zLnJlZmluZXJzLnB1c2gobmV3IEVOTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyKCkpO1xuICAgICAgICByZXR1cm4gb3B0aW9ucztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jb25maWd1cmF0aW9uLmpzLm1hcCIsImltcG9ydCB7IFJlZmVyZW5jZVdpdGhUaW1lem9uZSwgUGFyc2luZ0NvbXBvbmVudHMsIFBhcnNpbmdSZXN1bHQgfSBmcm9tIFwiLi9yZXN1bHRzLmpzXCI7XG5pbXBvcnQgRU5EZWZhdWx0Q29uZmlndXJhdGlvbiBmcm9tIFwiLi9sb2NhbGVzL2VuL2NvbmZpZ3VyYXRpb24uanNcIjtcbmV4cG9ydCBjbGFzcyBDaHJvbm8ge1xuICAgIHBhcnNlcnM7XG4gICAgcmVmaW5lcnM7XG4gICAgZGVmYXVsdENvbmZpZyA9IG5ldyBFTkRlZmF1bHRDb25maWd1cmF0aW9uKCk7XG4gICAgY29uc3RydWN0b3IoY29uZmlndXJhdGlvbikge1xuICAgICAgICBjb25maWd1cmF0aW9uID0gY29uZmlndXJhdGlvbiB8fCB0aGlzLmRlZmF1bHRDb25maWcuY3JlYXRlQ2FzdWFsQ29uZmlndXJhdGlvbigpO1xuICAgICAgICB0aGlzLnBhcnNlcnMgPSBbLi4uY29uZmlndXJhdGlvbi5wYXJzZXJzXTtcbiAgICAgICAgdGhpcy5yZWZpbmVycyA9IFsuLi5jb25maWd1cmF0aW9uLnJlZmluZXJzXTtcbiAgICB9XG4gICAgY2xvbmUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgQ2hyb25vKHtcbiAgICAgICAgICAgIHBhcnNlcnM6IFsuLi50aGlzLnBhcnNlcnNdLFxuICAgICAgICAgICAgcmVmaW5lcnM6IFsuLi50aGlzLnJlZmluZXJzXSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHBhcnNlRGF0ZSh0ZXh0LCByZWZlcmVuY2VEYXRlLCBvcHRpb24pIHtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IHRoaXMucGFyc2UodGV4dCwgcmVmZXJlbmNlRGF0ZSwgb3B0aW9uKTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHMubGVuZ3RoID4gMCA/IHJlc3VsdHNbMF0uc3RhcnQuZGF0ZSgpIDogbnVsbDtcbiAgICB9XG4gICAgcGFyc2UodGV4dCwgcmVmZXJlbmNlRGF0ZSwgb3B0aW9uKSB7XG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSBuZXcgUGFyc2luZ0NvbnRleHQodGV4dCwgcmVmZXJlbmNlRGF0ZSwgb3B0aW9uKTtcbiAgICAgICAgbGV0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgdGhpcy5wYXJzZXJzLmZvckVhY2goKHBhcnNlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkUmVzdWx0cyA9IENocm9uby5leGVjdXRlUGFyc2VyKGNvbnRleHQsIHBhcnNlcik7XG4gICAgICAgICAgICByZXN1bHRzID0gcmVzdWx0cy5jb25jYXQocGFyc2VkUmVzdWx0cyk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXN1bHRzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhLmluZGV4IC0gYi5pbmRleDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVmaW5lcnMuZm9yRWFjaChmdW5jdGlvbiAocmVmaW5lcikge1xuICAgICAgICAgICAgcmVzdWx0cyA9IHJlZmluZXIucmVmaW5lKGNvbnRleHQsIHJlc3VsdHMpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuICAgIHN0YXRpYyBleGVjdXRlUGFyc2VyKGNvbnRleHQsIHBhcnNlcikge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgICAgIGNvbnN0IHBhdHRlcm4gPSBwYXJzZXIucGF0dGVybihjb250ZXh0KTtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWxUZXh0ID0gY29udGV4dC50ZXh0O1xuICAgICAgICBsZXQgcmVtYWluaW5nVGV4dCA9IGNvbnRleHQudGV4dDtcbiAgICAgICAgbGV0IG1hdGNoID0gcGF0dGVybi5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgICAgICB3aGlsZSAobWF0Y2gpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gbWF0Y2guaW5kZXggKyBvcmlnaW5hbFRleHQubGVuZ3RoIC0gcmVtYWluaW5nVGV4dC5sZW5ndGg7XG4gICAgICAgICAgICBtYXRjaC5pbmRleCA9IGluZGV4O1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gcGFyc2VyLmV4dHJhY3QoY29udGV4dCwgbWF0Y2gpO1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZW1haW5pbmdUZXh0ID0gb3JpZ2luYWxUZXh0LnN1YnN0cmluZyhtYXRjaC5pbmRleCArIDEpO1xuICAgICAgICAgICAgICAgIG1hdGNoID0gcGF0dGVybi5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHBhcnNlZFJlc3VsdCA9IG51bGw7XG4gICAgICAgICAgICBpZiAocmVzdWx0IGluc3RhbmNlb2YgUGFyc2luZ1Jlc3VsdCkge1xuICAgICAgICAgICAgICAgIHBhcnNlZFJlc3VsdCA9IHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIFBhcnNpbmdDb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgcGFyc2VkUmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgICAgICAgICAgcGFyc2VkUmVzdWx0LnN0YXJ0ID0gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFyc2VkUmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSwgcmVzdWx0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZEluZGV4ID0gcGFyc2VkUmVzdWx0LmluZGV4O1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkVGV4dCA9IHBhcnNlZFJlc3VsdC50ZXh0O1xuICAgICAgICAgICAgY29udGV4dC5kZWJ1ZygoKSA9PiBjb25zb2xlLmxvZyhgJHtwYXJzZXIuY29uc3RydWN0b3IubmFtZX0gZXh0cmFjdGVkIChhdCBpbmRleD0ke3BhcnNlZEluZGV4fSkgJyR7cGFyc2VkVGV4dH0nYCkpO1xuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHBhcnNlZFJlc3VsdCk7XG4gICAgICAgICAgICByZW1haW5pbmdUZXh0ID0gb3JpZ2luYWxUZXh0LnN1YnN0cmluZyhwYXJzZWRJbmRleCArIHBhcnNlZFRleHQubGVuZ3RoKTtcbiAgICAgICAgICAgIG1hdGNoID0gcGF0dGVybi5leGVjKHJlbWFpbmluZ1RleHQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBQYXJzaW5nQ29udGV4dCB7XG4gICAgdGV4dDtcbiAgICBvcHRpb247XG4gICAgcmVmZXJlbmNlO1xuICAgIHJlZkRhdGU7XG4gICAgY29uc3RydWN0b3IodGV4dCwgcmVmRGF0ZSwgb3B0aW9uKSB7XG4gICAgICAgIHRoaXMudGV4dCA9IHRleHQ7XG4gICAgICAgIHRoaXMub3B0aW9uID0gb3B0aW9uID8/IHt9O1xuICAgICAgICB0aGlzLnJlZmVyZW5jZSA9IFJlZmVyZW5jZVdpdGhUaW1lem9uZS5mcm9tSW5wdXQocmVmRGF0ZSwgdGhpcy5vcHRpb24udGltZXpvbmVzKTtcbiAgICAgICAgdGhpcy5yZWZEYXRlID0gdGhpcy5yZWZlcmVuY2UuaW5zdGFudDtcbiAgICB9XG4gICAgY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoY29tcG9uZW50cykge1xuICAgICAgICBpZiAoY29tcG9uZW50cyBpbnN0YW5jZW9mIFBhcnNpbmdDb21wb25lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50cztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFBhcnNpbmdDb21wb25lbnRzKHRoaXMucmVmZXJlbmNlLCBjb21wb25lbnRzKTtcbiAgICB9XG4gICAgY3JlYXRlUGFyc2luZ1Jlc3VsdChpbmRleCwgdGV4dE9yRW5kSW5kZXgsIHN0YXJ0Q29tcG9uZW50cywgZW5kQ29tcG9uZW50cykge1xuICAgICAgICBjb25zdCB0ZXh0ID0gdHlwZW9mIHRleHRPckVuZEluZGV4ID09PSBcInN0cmluZ1wiID8gdGV4dE9yRW5kSW5kZXggOiB0aGlzLnRleHQuc3Vic3RyaW5nKGluZGV4LCB0ZXh0T3JFbmRJbmRleCk7XG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gc3RhcnRDb21wb25lbnRzID8gdGhpcy5jcmVhdGVQYXJzaW5nQ29tcG9uZW50cyhzdGFydENvbXBvbmVudHMpIDogbnVsbDtcbiAgICAgICAgY29uc3QgZW5kID0gZW5kQ29tcG9uZW50cyA/IHRoaXMuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoZW5kQ29tcG9uZW50cykgOiBudWxsO1xuICAgICAgICByZXR1cm4gbmV3IFBhcnNpbmdSZXN1bHQodGhpcy5yZWZlcmVuY2UsIGluZGV4LCB0ZXh0LCBzdGFydCwgZW5kKTtcbiAgICB9XG4gICAgZGVidWcoYmxvY2spIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9uLmRlYnVnKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcHRpb24uZGVidWcgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgIHRoaXMub3B0aW9uLmRlYnVnKGJsb2NrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLm9wdGlvbi5kZWJ1ZztcbiAgICAgICAgICAgICAgICBoYW5kbGVyLmRlYnVnKGJsb2NrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNocm9uby5qcy5tYXAiLCJleHBvcnQgY29uc3QgTlVNQkVSID0ge1xuICAgIFwi6Zu2XCI6IDAsXG4gICAgXCLjgIdcIjogMCxcbiAgICBcIuS4gFwiOiAxLFxuICAgIFwi5LqMXCI6IDIsXG4gICAgXCLkuKRcIjogMixcbiAgICBcIuS4iVwiOiAzLFxuICAgIFwi5ZubXCI6IDQsXG4gICAgXCLkupRcIjogNSxcbiAgICBcIuWFrVwiOiA2LFxuICAgIFwi5LiDXCI6IDcsXG4gICAgXCLlhatcIjogOCxcbiAgICBcIuS5nVwiOiA5LFxuICAgIFwi5Y2BXCI6IDEwLFxufTtcbmV4cG9ydCBjb25zdCBXRUVLREFZX09GRlNFVCA9IHtcbiAgICBcIuWkqVwiOiAwLFxuICAgIFwi5pelXCI6IDAsXG4gICAgXCLkuIBcIjogMSxcbiAgICBcIuS6jFwiOiAyLFxuICAgIFwi5LiJXCI6IDMsXG4gICAgXCLlm5tcIjogNCxcbiAgICBcIuS6lFwiOiA1LFxuICAgIFwi5YWtXCI6IDYsXG59O1xuZXhwb3J0IGZ1bmN0aW9uIHpoU3RyaW5nVG9OdW1iZXIodGV4dCkge1xuICAgIGxldCBudW1iZXIgPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjaGFyID0gdGV4dFtpXTtcbiAgICAgICAgaWYgKGNoYXIgPT09IFwi5Y2BXCIpIHtcbiAgICAgICAgICAgIG51bWJlciA9IG51bWJlciA9PT0gMCA/IE5VTUJFUltjaGFyXSA6IG51bWJlciAqIE5VTUJFUltjaGFyXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG51bWJlciArPSBOVU1CRVJbY2hhcl07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydCBmdW5jdGlvbiB6aFN0cmluZ1RvWWVhcih0ZXh0KSB7XG4gICAgbGV0IHN0cmluZyA9IFwiXCI7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNoYXIgPSB0ZXh0W2ldO1xuICAgICAgICBzdHJpbmcgPSBzdHJpbmcgKyBOVU1CRVJbY2hhcl07XG4gICAgfVxuICAgIHJldHVybiBwYXJzZUludChzdHJpbmcpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29uc3RhbnRzLmpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuaW1wb3J0IHsgTlVNQkVSLCB6aFN0cmluZ1RvTnVtYmVyLCB6aFN0cmluZ1RvWWVhciB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmNvbnN0IFlFQVJfR1JPVVAgPSAxO1xuY29uc3QgTU9OVEhfR1JPVVAgPSAyO1xuY29uc3QgREFZX0dST1VQID0gMztcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpISGFuc0RhdGVQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ0V4cChcIihcIiArXG4gICAgICAgICAgICBcIlxcXFxkezIsNH18XCIgK1xuICAgICAgICAgICAgXCJbXCIgK1xuICAgICAgICAgICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICAgICAgICAgIFwiXXs0fXxcIiArXG4gICAgICAgICAgICBcIltcIiArXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgICAgICAgICAgXCJdezJ9XCIgK1xuICAgICAgICAgICAgXCIpP1wiICtcbiAgICAgICAgICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICAgICAgICAgIFwiKD865bm0KT9cIiArXG4gICAgICAgICAgICBcIig/OltcXFxcc3wsfO+8jF0qKVwiICtcbiAgICAgICAgICAgIFwiKFwiICtcbiAgICAgICAgICAgIFwiXFxcXGR7MSwyfXxcIiArXG4gICAgICAgICAgICBcIltcIiArXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgICAgICAgICAgXCJdezEsM31cIiArXG4gICAgICAgICAgICBcIilcIiArXG4gICAgICAgICAgICBcIig/OlxcXFxzKilcIiArXG4gICAgICAgICAgICBcIig/OuaciClcIiArXG4gICAgICAgICAgICBcIig/OlxcXFxzKilcIiArXG4gICAgICAgICAgICBcIihcIiArXG4gICAgICAgICAgICBcIlxcXFxkezEsMn18XCIgK1xuICAgICAgICAgICAgXCJbXCIgK1xuICAgICAgICAgICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICAgICAgICAgIFwiXXsxLDN9XCIgK1xuICAgICAgICAgICAgXCIpP1wiICtcbiAgICAgICAgICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICAgICAgICAgIFwiKD865pelfOWPtyk/XCIpO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGxldCBtb250aCA9IHBhcnNlSW50KG1hdGNoW01PTlRIX0dST1VQXSk7XG4gICAgICAgIGlmIChpc05hTihtb250aCkpXG4gICAgICAgICAgICBtb250aCA9IHpoU3RyaW5nVG9OdW1iZXIobWF0Y2hbTU9OVEhfR1JPVVBdKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIG1vbnRoKTtcbiAgICAgICAgaWYgKG1hdGNoW0RBWV9HUk9VUF0pIHtcbiAgICAgICAgICAgIGxldCBkYXkgPSBwYXJzZUludChtYXRjaFtEQVlfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChpc05hTihkYXkpKVxuICAgICAgICAgICAgICAgIGRheSA9IHpoU3RyaW5nVG9OdW1iZXIobWF0Y2hbREFZX0dST1VQXSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIGRheSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgY29udGV4dC5yZWZEYXRlLmdldERhdGUoKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoW1lFQVJfR1JPVVBdKSB7XG4gICAgICAgICAgICBsZXQgeWVhciA9IHBhcnNlSW50KG1hdGNoW1lFQVJfR1JPVVBdKTtcbiAgICAgICAgICAgIGlmIChpc05hTih5ZWFyKSlcbiAgICAgICAgICAgICAgICB5ZWFyID0gemhTdHJpbmdUb1llYXIobWF0Y2hbWUVBUl9HUk9VUF0pO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgeWVhcik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIGNvbnRleHQucmVmRGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPVpISGFuc0RhdGVQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBhZGREdXJhdGlvbiB9IGZyb20gXCIuLi8uLi8uLi8uLi9jYWxjdWxhdGlvbi9kdXJhdGlvbi5qc1wiO1xuaW1wb3J0IHsgTlVNQkVSLCB6aFN0cmluZ1RvTnVtYmVyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgUEFUVEVSTiA9IG5ldyBSZWdFeHAoXCIoXFxcXGQrfFtcIiArXG4gICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICBcIl0rfOWNinzlh6ApKD86XFxcXHMqKVwiICtcbiAgICBcIig/OuS4qik/XCIgK1xuICAgIFwiKOenkig/OumSnyk/fOWIhumSn3zlsI/ml7Z86ZKffOaXpXzlpKl85pif5pyffOekvOaLnHzmnIh85bm0KVwiICtcbiAgICBcIig/Oig/OuS5i3zov4cpP+WQjnwoPzrkuYspP+WGhSlcIiwgXCJpXCIpO1xuY29uc3QgTlVNQkVSX0dST1VQID0gMTtcbmNvbnN0IFVOSVRfR1JPVVAgPSAyO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zRGVhZGxpbmVGb3JtYXRQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChtYXRjaC5pbmRleCwgbWF0Y2hbMF0pO1xuICAgICAgICBsZXQgbnVtYmVyID0gcGFyc2VJbnQobWF0Y2hbTlVNQkVSX0dST1VQXSk7XG4gICAgICAgIGlmIChpc05hTihudW1iZXIpKSB7XG4gICAgICAgICAgICBudW1iZXIgPSB6aFN0cmluZ1RvTnVtYmVyKG1hdGNoW05VTUJFUl9HUk9VUF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc05hTihudW1iZXIpKSB7XG4gICAgICAgICAgICBjb25zdCBzdHJpbmcgPSBtYXRjaFtOVU1CRVJfR1JPVVBdO1xuICAgICAgICAgICAgaWYgKHN0cmluZyA9PT0gXCLlh6BcIikge1xuICAgICAgICAgICAgICAgIG51bWJlciA9IDM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChzdHJpbmcgPT09IFwi5Y2KXCIpIHtcbiAgICAgICAgICAgICAgICBudW1iZXIgPSAwLjU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkdXJhdGlvbiA9IHt9O1xuICAgICAgICBjb25zdCB1bml0ID0gbWF0Y2hbVU5JVF9HUk9VUF07XG4gICAgICAgIGNvbnN0IHVuaXRBYmJyID0gdW5pdFswXTtcbiAgICAgICAgaWYgKHVuaXRBYmJyLm1hdGNoKC9b5pel5aSp5pif56S85pyI5bm0XS8pKSB7XG4gICAgICAgICAgICBpZiAodW5pdEFiYnIgPT0gXCLml6VcIiB8fCB1bml0QWJiciA9PSBcIuWkqVwiKSB7XG4gICAgICAgICAgICAgICAgZHVyYXRpb24uZGF5ID0gbnVtYmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodW5pdEFiYnIgPT0gXCLmmJ9cIiB8fCB1bml0QWJiciA9PSBcIuekvFwiKSB7XG4gICAgICAgICAgICAgICAgZHVyYXRpb24ud2VlayA9IG51bWJlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHVuaXRBYmJyID09IFwi5pyIXCIpIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbi5tb250aCA9IG51bWJlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHVuaXRBYmJyID09IFwi5bm0XCIpIHtcbiAgICAgICAgICAgICAgICBkdXJhdGlvbi55ZWFyID0gbnVtYmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZGF0ZSA9IGFkZER1cmF0aW9uKGNvbnRleHQucmVmRGF0ZSwgZHVyYXRpb24pO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgZGF0ZS5nZXRGdWxsWWVhcigpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAodW5pdEFiYnIgPT0gXCLnp5JcIikge1xuICAgICAgICAgICAgZHVyYXRpb24uc2Vjb25kID0gbnVtYmVyO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHVuaXRBYmJyID09IFwi5YiGXCIpIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLm1pbnV0ZSA9IG51bWJlcjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh1bml0QWJiciA9PSBcIuWwj1wiIHx8IHVuaXRBYmJyID09IFwi6ZKfXCIpIHtcbiAgICAgICAgICAgIGR1cmF0aW9uLmhvdXIgPSBudW1iZXI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0ZSA9IGFkZER1cmF0aW9uKGNvbnRleHQucmVmRGF0ZSwgZHVyYXRpb24pO1xuICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCBkYXRlLmdldEhvdXJzKCkpO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibWludXRlXCIsIGRhdGUuZ2V0TWludXRlcygpKTtcbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInNlY29uZFwiLCBkYXRlLmdldFNlY29uZHMoKSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9WkhIYW5zRGVhZGxpbmVGb3JtYXRQYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBXRUVLREFZX09GRlNFVCB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKFwiKD88cHJlZml4PuS4inzkuIt86L+ZKSg/OuS4qik/KD865pif5pyffOekvOaLnHzlkagpKD88d2Vla2RheT5cIiArIE9iamVjdC5rZXlzKFdFRUtEQVlfT0ZGU0VUKS5qb2luKFwifFwiKSArIFwiKVwiKTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpISGFuc1JlbGF0aW9uV2Vla2RheVBhcnNlciBleHRlbmRzIEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIHtcbiAgICBpbm5lclBhdHRlcm4oKSB7XG4gICAgICAgIHJldHVybiBQQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gY29udGV4dC5jcmVhdGVQYXJzaW5nUmVzdWx0KG1hdGNoLmluZGV4LCBtYXRjaFswXSk7XG4gICAgICAgIGNvbnN0IGRheU9mV2VlayA9IG1hdGNoLmdyb3Vwcy53ZWVrZGF5O1xuICAgICAgICBjb25zdCBvZmZzZXQgPSBXRUVLREFZX09GRlNFVFtkYXlPZldlZWtdO1xuICAgICAgICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgbGV0IG1vZGlmaWVyID0gbnVsbDtcbiAgICAgICAgY29uc3QgcHJlZml4ID0gbWF0Y2guZ3JvdXBzLnByZWZpeDtcbiAgICAgICAgaWYgKHByZWZpeCA9PSBcIuS4ilwiKSB7XG4gICAgICAgICAgICBtb2RpZmllciA9IFwibGFzdFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHByZWZpeCA9PSBcIuS4i1wiKSB7XG4gICAgICAgICAgICBtb2RpZmllciA9IFwibmV4dFwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHByZWZpeCA9PSBcIui/mVwiKSB7XG4gICAgICAgICAgICBtb2RpZmllciA9IFwidGhpc1wiO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShjb250ZXh0LnJlZkRhdGUuZ2V0VGltZSgpKTtcbiAgICAgICAgbGV0IHN0YXJ0TW9tZW50Rml4ZWQgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgcmVmT2Zmc2V0ID0gZGF0ZS5nZXREYXkoKTtcbiAgICAgICAgaWYgKG1vZGlmaWVyID09IFwibGFzdFwiIHx8IG1vZGlmaWVyID09IFwicGFzdFwiKSB7XG4gICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyAob2Zmc2V0IC0gNyAtIHJlZk9mZnNldCkpO1xuICAgICAgICAgICAgc3RhcnRNb21lbnRGaXhlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobW9kaWZpZXIgPT0gXCJuZXh0XCIpIHtcbiAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIChvZmZzZXQgKyA3IC0gcmVmT2Zmc2V0KSk7XG4gICAgICAgICAgICBzdGFydE1vbWVudEZpeGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtb2RpZmllciA9PSBcInRoaXNcIikge1xuICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgKG9mZnNldCAtIHJlZk9mZnNldCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbGV0IGRpZmYgPSBvZmZzZXQgLSByZWZPZmZzZXQ7XG4gICAgICAgICAgICBpZiAoTWF0aC5hYnMoZGlmZiAtIDcpIDwgTWF0aC5hYnMoZGlmZikpIHtcbiAgICAgICAgICAgICAgICBkaWZmIC09IDc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoTWF0aC5hYnMoZGlmZiArIDcpIDwgTWF0aC5hYnMoZGlmZikpIHtcbiAgICAgICAgICAgICAgICBkaWZmICs9IDc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyBkaWZmKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwid2Vla2RheVwiLCBvZmZzZXQpO1xuICAgICAgICBpZiAoc3RhcnRNb21lbnRGaXhlZCkge1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBkYXRlLmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1vbnRoXCIsIGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwieWVhclwiLCBkYXRlLmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9WkhIYW5zUmVsYXRpb25XZWVrZGF5UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuaW1wb3J0IHsgTlVNQkVSLCB6aFN0cmluZ1RvTnVtYmVyIH0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuY29uc3QgRklSU1RfUkVHX1BBVFRFUk4gPSBuZXcgUmVnRXhwKFwiKD865LuOfOiHqik/XCIgK1xuICAgIFwiKD86XCIgK1xuICAgIFwiKOS7inzmmI585YmNfOWkp+WJjXzlkI585aSn5ZCOfOaYqCko5pepfOacnXzmmZopfFwiICtcbiAgICBcIijkuIooPzrljYgpfOaXqSg/OuS4iil85LiLKD865Y2IKXzmmZooPzrkuIopfOWknCg/OuaZmik/fOS4rSg/OuWNiCl85YeMKD865pmoKSl8XCIgK1xuICAgIFwiKOS7inzmmI585YmNfOWkp+WJjXzlkI585aSn5ZCOfOaYqCkoPzrml6V85aSpKVwiICtcbiAgICBcIig/OltcXFxccyzvvIxdKilcIiArXG4gICAgXCIoPzoo5LiKKD865Y2IKXzml6koPzrkuIopfOS4iyg/OuWNiCl85pmaKD865LiKKXzlpJwoPzrmmZopP3zkuK0oPzrljYgpfOWHjCg/OuaZqCkpKT9cIiArXG4gICAgXCIpP1wiICtcbiAgICBcIig/OltcXFxccyzvvIxdKilcIiArXG4gICAgXCIoPzooXFxcXGQrfFtcIiArXG4gICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICBcIl0rKSg/OlxcXFxzKikoPzrngrl85pe2fDp877yaKVwiICtcbiAgICBcIig/OlxcXFxzKilcIiArXG4gICAgXCIoXFxcXGQrfOWNinzmraN85pW0fFtcIiArXG4gICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICBcIl0rKT8oPzpcXFxccyopKD865YiGfDp877yaKT9cIiArXG4gICAgXCIoPzpcXFxccyopXCIgK1xuICAgIFwiKFxcXFxkK3xbXCIgK1xuICAgIE9iamVjdC5rZXlzKE5VTUJFUikuam9pbihcIlwiKSArXG4gICAgXCJdKyk/KD86XFxcXHMqKSg/Ouenkik/KVwiICtcbiAgICBcIig/OlxcXFxzKihBLk0ufFAuTS58QU0/fFBNPykpP1wiLCBcImlcIik7XG5jb25zdCBTRUNPTkRfUkVHX1BBVFRFUk4gPSBuZXcgUmVnRXhwKFwiKD86XlxcXFxzKig/OuWIsHzoh7N8XFxcXC18XFxcXOKAk3xcXFxcfnxcXFxc44CcKVxcXFxzKilcIiArXG4gICAgXCIoPzpcIiArXG4gICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSjml6l85pydfOaZmil8XCIgK1xuICAgIFwiKOS4iig/OuWNiCl85pepKD865LiKKXzkuIsoPzrljYgpfOaZmig/OuS4iil85aScKD865pmaKT985LitKD865Y2IKXzlh4woPzrmmagpKXxcIiArXG4gICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSg/OuaXpXzlpKkpXCIgK1xuICAgIFwiKD86W1xcXFxzLO+8jF0qKVwiICtcbiAgICBcIig/OijkuIooPzrljYgpfOaXqSg/OuS4iil85LiLKD865Y2IKXzmmZooPzrkuIopfOWknCg/OuaZmik/fOS4rSg/OuWNiCl85YeMKD865pmoKSkpP1wiICtcbiAgICBcIik/XCIgK1xuICAgIFwiKD86W1xcXFxzLO+8jF0qKVwiICtcbiAgICBcIig/OihcXFxcZCt8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspKD86XFxcXHMqKSg/OueCuXzml7Z8OnzvvJopXCIgK1xuICAgIFwiKD86XFxcXHMqKVwiICtcbiAgICBcIihcXFxcZCt85Y2KfOato3zmlbR8W1wiICtcbiAgICBPYmplY3Qua2V5cyhOVU1CRVIpLmpvaW4oXCJcIikgK1xuICAgIFwiXSspPyg/OlxcXFxzKikoPzrliIZ8OnzvvJopP1wiICtcbiAgICBcIig/OlxcXFxzKilcIiArXG4gICAgXCIoXFxcXGQrfFtcIiArXG4gICAgT2JqZWN0LmtleXMoTlVNQkVSKS5qb2luKFwiXCIpICtcbiAgICBcIl0rKT8oPzpcXFxccyopKD8656eSKT8pXCIgK1xuICAgIFwiKD86XFxcXHMqKEEuTS58UC5NLnxBTT98UE0/KSk/XCIsIFwiaVwiKTtcbmNvbnN0IERBWV9HUk9VUF8xID0gMTtcbmNvbnN0IFpIX0FNX1BNX0hPVVJfR1JPVVBfMSA9IDI7XG5jb25zdCBaSF9BTV9QTV9IT1VSX0dST1VQXzIgPSAzO1xuY29uc3QgREFZX0dST1VQXzMgPSA0O1xuY29uc3QgWkhfQU1fUE1fSE9VUl9HUk9VUF8zID0gNTtcbmNvbnN0IEhPVVJfR1JPVVAgPSA2O1xuY29uc3QgTUlOVVRFX0dST1VQID0gNztcbmNvbnN0IFNFQ09ORF9HUk9VUCA9IDg7XG5jb25zdCBBTV9QTV9IT1VSX0dST1VQID0gOTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpISGFuc1RpbWVFeHByZXNzaW9uUGFyc2VyIGV4dGVuZHMgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcge1xuICAgIHBhdHRlcm5MZWZ0Qm91bmRhcnkoKSB7XG4gICAgICAgIHJldHVybiBcIigpXCI7XG4gICAgfVxuICAgIGlubmVyUGF0dGVybigpIHtcbiAgICAgICAgcmV0dXJuIEZJUlNUX1JFR19QQVRURVJOO1xuICAgIH1cbiAgICBpbm5lckV4dHJhY3QoY29udGV4dCwgbWF0Y2gpIHtcbiAgICAgICAgaWYgKG1hdGNoLmluZGV4ID4gMCAmJiBjb250ZXh0LnRleHRbbWF0Y2guaW5kZXggLSAxXS5tYXRjaCgvXFx3LykpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChtYXRjaC5pbmRleCwgbWF0Y2hbMF0pO1xuICAgICAgICBjb25zdCBzdGFydE1vbWVudCA9IG5ldyBEYXRlKGNvbnRleHQucmVmZXJlbmNlLmluc3RhbnQuZ2V0VGltZSgpKTtcbiAgICAgICAgaWYgKG1hdGNoW0RBWV9HUk9VUF8xXSkge1xuICAgICAgICAgICAgY29uc3QgZGF5MSA9IG1hdGNoW0RBWV9HUk9VUF8xXTtcbiAgICAgICAgICAgIGlmIChkYXkxID09IFwi5piOXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29udGV4dC5yZWZlcmVuY2UuaW5zdGFudC5nZXRIb3VycygpID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLmmKhcIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSAtIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWkp+WJjVwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgLSAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLlkI5cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5aSn5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSArIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImRheVwiLCBzdGFydE1vbWVudC5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcIm1vbnRoXCIsIHN0YXJ0TW9tZW50LmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIHN0YXJ0TW9tZW50LmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1hdGNoW0RBWV9HUk9VUF8zXSkge1xuICAgICAgICAgICAgY29uc3QgZGF5MyA9IG1hdGNoW0RBWV9HUk9VUF8zXTtcbiAgICAgICAgICAgIGlmIChkYXkzID09IFwi5piOXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuaYqFwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgLSAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLliY1cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBzdGFydE1vbWVudC5zZXREYXRlKHN0YXJ0TW9tZW50LmdldERhdGUoKSAtIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWQjlwiKSB7XG4gICAgICAgICAgICAgICAgc3RhcnRNb21lbnQuc2V0RGF0ZShzdGFydE1vbWVudC5nZXREYXRlKCkgKyAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlpKflkI5cIikge1xuICAgICAgICAgICAgICAgIHN0YXJ0TW9tZW50LnNldERhdGUoc3RhcnRNb21lbnQuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIHN0YXJ0TW9tZW50LmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgc3RhcnRNb21lbnQuZ2V0TW9udGgoKSArIDEpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInllYXJcIiwgc3RhcnRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgc3RhcnRNb21lbnQuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1vbnRoXCIsIHN0YXJ0TW9tZW50LmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcInllYXJcIiwgc3RhcnRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGhvdXIgPSAwO1xuICAgICAgICBsZXQgbWludXRlID0gMDtcbiAgICAgICAgbGV0IG1lcmlkaWVtID0gLTE7XG4gICAgICAgIGlmIChtYXRjaFtTRUNPTkRfR1JPVVBdKSB7XG4gICAgICAgICAgICBsZXQgc2Vjb25kID0gcGFyc2VJbnQobWF0Y2hbU0VDT05EX0dST1VQXSk7XG4gICAgICAgICAgICBpZiAoaXNOYU4oc2Vjb25kKSkge1xuICAgICAgICAgICAgICAgIHNlY29uZCA9IHpoU3RyaW5nVG9OdW1iZXIobWF0Y2hbU0VDT05EX0dST1VQXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2Vjb25kID49IDYwKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcInNlY29uZFwiLCBzZWNvbmQpO1xuICAgICAgICB9XG4gICAgICAgIGhvdXIgPSBwYXJzZUludChtYXRjaFtIT1VSX0dST1VQXSk7XG4gICAgICAgIGlmIChpc05hTihob3VyKSkge1xuICAgICAgICAgICAgaG91ciA9IHpoU3RyaW5nVG9OdW1iZXIobWF0Y2hbSE9VUl9HUk9VUF0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdKSB7XG4gICAgICAgICAgICBpZiAobWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBcIuWNilwiKSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gMzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChtYXRjaFtNSU5VVEVfR1JPVVBdID09IFwi5q2jXCIgfHwgbWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBcIuaVtFwiKSB7XG4gICAgICAgICAgICAgICAgbWludXRlID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIG1pbnV0ZSA9IHBhcnNlSW50KG1hdGNoW01JTlVURV9HUk9VUF0pO1xuICAgICAgICAgICAgICAgIGlmIChpc05hTihtaW51dGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pbnV0ZSA9IHpoU3RyaW5nVG9OdW1iZXIobWF0Y2hbTUlOVVRFX0dST1VQXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGhvdXIgPiAxMDApIHtcbiAgICAgICAgICAgIG1pbnV0ZSA9IGhvdXIgJSAxMDA7XG4gICAgICAgICAgICBob3VyID0gTWF0aC5mbG9vcihob3VyIC8gMTAwKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWludXRlID49IDYwKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG91ciA+IDI0KSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaG91ciA+PSAxMikge1xuICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtYXRjaFtBTV9QTV9IT1VSX0dST1VQXSkge1xuICAgICAgICAgICAgaWYgKGhvdXIgPiAxMilcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGFtcG0gPSBtYXRjaFtBTV9QTV9IT1VSX0dST1VQXVswXS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJhXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFtcG0gPT0gXCJwXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8xXSkge1xuICAgICAgICAgICAgY29uc3QgemhBTVBNU3RyaW5nMSA9IG1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMV07XG4gICAgICAgICAgICBjb25zdCB6aEFNUE0xID0gemhBTVBNU3RyaW5nMVswXTtcbiAgICAgICAgICAgIGlmICh6aEFNUE0xID09IFwi5pepXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMSA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMl0pIHtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTVN0cmluZzIgPSBtYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzJdO1xuICAgICAgICAgICAgY29uc3QgemhBTVBNMiA9IHpoQU1QTVN0cmluZzJbMF07XG4gICAgICAgICAgICBpZiAoemhBTVBNMiA9PSBcIuS4ilwiIHx8IHpoQU1QTTIgPT0gXCLml6lcIiB8fCB6aEFNUE0yID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMiA9PSBcIuS4i1wiIHx8IHpoQU1QTTIgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChtYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBjb25zdCB6aEFNUE1TdHJpbmczID0gbWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8zXTtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTTMgPSB6aEFNUE1TdHJpbmczWzBdO1xuICAgICAgICAgICAgaWYgKHpoQU1QTTMgPT0gXCLkuIpcIiB8fCB6aEFNUE0zID09IFwi5pepXCIgfHwgemhBTVBNMyA9PSBcIuWHjFwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAwO1xuICAgICAgICAgICAgICAgIGlmIChob3VyID09IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHpoQU1QTTMgPT0gXCLkuItcIiB8fCB6aEFNUE0zID09IFwi5pmaXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImhvdXJcIiwgaG91cik7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtaW51dGVcIiwgbWludXRlKTtcbiAgICAgICAgaWYgKG1lcmlkaWVtID49IDApIHtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtZXJpZGllbVwiLCBtZXJpZGllbSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoaG91ciA8IDEyKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzZWNvbmRNYXRjaCA9IFNFQ09ORF9SRUdfUEFUVEVSTi5leGVjKGNvbnRleHQudGV4dC5zdWJzdHJpbmcocmVzdWx0LmluZGV4ICsgcmVzdWx0LnRleHQubGVuZ3RoKSk7XG4gICAgICAgIGlmICghc2Vjb25kTWF0Y2gpIHtcbiAgICAgICAgICAgIGlmIChyZXN1bHQudGV4dC5tYXRjaCgvXlxcZCskLykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGVuZE1vbWVudCA9IG5ldyBEYXRlKHN0YXJ0TW9tZW50LmdldFRpbWUoKSk7XG4gICAgICAgIGlmIChzZWNvbmRNYXRjaFtEQVlfR1JPVVBfMV0gfHwgc2Vjb25kTWF0Y2hbREFZX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBlbmRNb21lbnQgPSBuZXcgRGF0ZShjb250ZXh0LnJlZmVyZW5jZS5pbnN0YW50LmdldFRpbWUoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LmVuZCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ0NvbXBvbmVudHMoKTtcbiAgICAgICAgaWYgKHNlY29uZE1hdGNoW0RBWV9HUk9VUF8xXSkge1xuICAgICAgICAgICAgY29uc3QgZGF5MSA9IHNlY29uZE1hdGNoW0RBWV9HUk9VUF8xXTtcbiAgICAgICAgICAgIGlmIChkYXkxID09IFwi5piOXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29udGV4dC5yZWZlcmVuY2UuaW5zdGFudC5nZXRIb3VycygpID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuaYqFwiKSB7XG4gICAgICAgICAgICAgICAgZW5kTW9tZW50LnNldERhdGUoZW5kTW9tZW50LmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWJjVwiKSB7XG4gICAgICAgICAgICAgICAgZW5kTW9tZW50LnNldERhdGUoZW5kTW9tZW50LmdldERhdGUoKSAtIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWkp+WJjVwiKSB7XG4gICAgICAgICAgICAgICAgZW5kTW9tZW50LnNldERhdGUoZW5kTW9tZW50LmdldERhdGUoKSAtIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWQjlwiKSB7XG4gICAgICAgICAgICAgICAgZW5kTW9tZW50LnNldERhdGUoZW5kTW9tZW50LmdldERhdGUoKSArIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWkp+WQjlwiKSB7XG4gICAgICAgICAgICAgICAgZW5kTW9tZW50LnNldERhdGUoZW5kTW9tZW50LmdldERhdGUoKSArIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJkYXlcIiwgZW5kTW9tZW50LmdldERhdGUoKSk7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcIm1vbnRoXCIsIGVuZE1vbWVudC5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcInllYXJcIiwgZW5kTW9tZW50LmdldEZ1bGxZZWFyKCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNlY29uZE1hdGNoW0RBWV9HUk9VUF8zXSkge1xuICAgICAgICAgICAgY29uc3QgZGF5MyA9IHNlY29uZE1hdGNoW0RBWV9HUk9VUF8zXTtcbiAgICAgICAgICAgIGlmIChkYXkzID09IFwi5piOXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5pioXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpIC0gMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5aSn5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBlbmRNb21lbnQuc2V0RGF0ZShlbmRNb21lbnQuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImRheVwiLCBlbmRNb21lbnQuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwibW9udGhcIiwgZW5kTW9tZW50LmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwieWVhclwiLCBlbmRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwiZGF5XCIsIGVuZE1vbWVudC5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5pbXBseShcIm1vbnRoXCIsIGVuZE1vbWVudC5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmltcGx5KFwieWVhclwiLCBlbmRNb21lbnQuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgaG91ciA9IDA7XG4gICAgICAgIG1pbnV0ZSA9IDA7XG4gICAgICAgIG1lcmlkaWVtID0gLTE7XG4gICAgICAgIGlmIChzZWNvbmRNYXRjaFtTRUNPTkRfR1JPVVBdKSB7XG4gICAgICAgICAgICBsZXQgc2Vjb25kID0gcGFyc2VJbnQoc2Vjb25kTWF0Y2hbU0VDT05EX0dST1VQXSk7XG4gICAgICAgICAgICBpZiAoaXNOYU4oc2Vjb25kKSkge1xuICAgICAgICAgICAgICAgIHNlY29uZCA9IHpoU3RyaW5nVG9OdW1iZXIoc2Vjb25kTWF0Y2hbU0VDT05EX0dST1VQXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2Vjb25kID49IDYwKVxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5hc3NpZ24oXCJzZWNvbmRcIiwgc2Vjb25kKTtcbiAgICAgICAgfVxuICAgICAgICBob3VyID0gcGFyc2VJbnQoc2Vjb25kTWF0Y2hbSE9VUl9HUk9VUF0pO1xuICAgICAgICBpZiAoaXNOYU4oaG91cikpIHtcbiAgICAgICAgICAgIGhvdXIgPSB6aFN0cmluZ1RvTnVtYmVyKHNlY29uZE1hdGNoW0hPVVJfR1JPVVBdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSkge1xuICAgICAgICAgICAgaWYgKHNlY29uZE1hdGNoW01JTlVURV9HUk9VUF0gPT0gXCLljYpcIikge1xuICAgICAgICAgICAgICAgIG1pbnV0ZSA9IDMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoc2Vjb25kTWF0Y2hbTUlOVVRFX0dST1VQXSA9PSBcIuato1wiIHx8IHNlY29uZE1hdGNoW01JTlVURV9HUk9VUF0gPT0gXCLmlbRcIikge1xuICAgICAgICAgICAgICAgIG1pbnV0ZSA9IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBtaW51dGUgPSBwYXJzZUludChzZWNvbmRNYXRjaFtNSU5VVEVfR1JPVVBdKTtcbiAgICAgICAgICAgICAgICBpZiAoaXNOYU4obWludXRlKSkge1xuICAgICAgICAgICAgICAgICAgICBtaW51dGUgPSB6aFN0cmluZ1RvTnVtYmVyKHNlY29uZE1hdGNoW01JTlVURV9HUk9VUF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChob3VyID4gMTAwKSB7XG4gICAgICAgICAgICBtaW51dGUgPSBob3VyICUgMTAwO1xuICAgICAgICAgICAgaG91ciA9IE1hdGguZmxvb3IoaG91ciAvIDEwMCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1pbnV0ZSA+PSA2MCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhvdXIgPiAyNCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGhvdXIgPj0gMTIpIHtcbiAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2Vjb25kTWF0Y2hbQU1fUE1fSE9VUl9HUk9VUF0pIHtcbiAgICAgICAgICAgIGlmIChob3VyID4gMTIpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb25zdCBhbXBtID0gc2Vjb25kTWF0Y2hbQU1fUE1fSE9VUl9HUk9VUF1bMF0udG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGlmIChhbXBtID09IFwiYVwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAwO1xuICAgICAgICAgICAgICAgIGlmIChob3VyID09IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChhbXBtID09IFwicFwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFyZXN1bHQuc3RhcnQuaXNDZXJ0YWluKFwibWVyaWRpZW1cIikpIHtcbiAgICAgICAgICAgICAgICBpZiAobWVyaWRpZW0gPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGFydC5nZXQoXCJob3VyXCIpID09IDEyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiaG91clwiLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3RhcnQuZ2V0KFwiaG91clwiKSAhPSAxMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmFzc2lnbihcImhvdXJcIiwgcmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgKyAxMik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc2Vjb25kTWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8xXSkge1xuICAgICAgICAgICAgY29uc3QgemhBTVBNU3RyaW5nMSA9IHNlY29uZE1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMV07XG4gICAgICAgICAgICBjb25zdCB6aEFNUE0xID0gemhBTVBNU3RyaW5nMVswXTtcbiAgICAgICAgICAgIGlmICh6aEFNUE0xID09IFwi5pepXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMSA9PSBcIuaZmlwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAxO1xuICAgICAgICAgICAgICAgIGlmIChob3VyICE9IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyICs9IDEyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNlY29uZE1hdGNoW1pIX0FNX1BNX0hPVVJfR1JPVVBfMl0pIHtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTVN0cmluZzIgPSBzZWNvbmRNYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzJdO1xuICAgICAgICAgICAgY29uc3QgemhBTVBNMiA9IHpoQU1QTVN0cmluZzJbMF07XG4gICAgICAgICAgICBpZiAoemhBTVBNMiA9PSBcIuS4ilwiIHx8IHpoQU1QTTIgPT0gXCLml6lcIiB8fCB6aEFNUE0yID09IFwi5YeMXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDA7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgPT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoemhBTVBNMiA9PSBcIuS4i1wiIHx8IHpoQU1QTTIgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIG1lcmlkaWVtID0gMTtcbiAgICAgICAgICAgICAgICBpZiAoaG91ciAhPSAxMilcbiAgICAgICAgICAgICAgICAgICAgaG91ciArPSAxMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzZWNvbmRNYXRjaFtaSF9BTV9QTV9IT1VSX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBjb25zdCB6aEFNUE1TdHJpbmczID0gc2Vjb25kTWF0Y2hbWkhfQU1fUE1fSE9VUl9HUk9VUF8zXTtcbiAgICAgICAgICAgIGNvbnN0IHpoQU1QTTMgPSB6aEFNUE1TdHJpbmczWzBdO1xuICAgICAgICAgICAgaWYgKHpoQU1QTTMgPT0gXCLkuIpcIiB8fCB6aEFNUE0zID09IFwi5pepXCIgfHwgemhBTVBNMyA9PSBcIuWHjFwiKSB7XG4gICAgICAgICAgICAgICAgbWVyaWRpZW0gPSAwO1xuICAgICAgICAgICAgICAgIGlmIChob3VyID09IDEyKVxuICAgICAgICAgICAgICAgICAgICBob3VyID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHpoQU1QTTMgPT0gXCLkuItcIiB8fCB6aEFNUE0zID09IFwi5pmaXCIpIHtcbiAgICAgICAgICAgICAgICBtZXJpZGllbSA9IDE7XG4gICAgICAgICAgICAgICAgaWYgKGhvdXIgIT0gMTIpXG4gICAgICAgICAgICAgICAgICAgIGhvdXIgKz0gMTI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0LnRleHQgPSByZXN1bHQudGV4dCArIHNlY29uZE1hdGNoWzBdO1xuICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcImhvdXJcIiwgaG91cik7XG4gICAgICAgIHJlc3VsdC5lbmQuYXNzaWduKFwibWludXRlXCIsIG1pbnV0ZSk7XG4gICAgICAgIGlmIChtZXJpZGllbSA+PSAwKSB7XG4gICAgICAgICAgICByZXN1bHQuZW5kLmFzc2lnbihcIm1lcmlkaWVtXCIsIG1lcmlkaWVtKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0QXRQTSA9IHJlc3VsdC5zdGFydC5pc0NlcnRhaW4oXCJtZXJpZGllbVwiKSAmJiByZXN1bHQuc3RhcnQuZ2V0KFwibWVyaWRpZW1cIikgPT0gMTtcbiAgICAgICAgICAgIGlmIChzdGFydEF0UE0gJiYgcmVzdWx0LnN0YXJ0LmdldChcImhvdXJcIikgPiBob3VyKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmVuZC5pbXBseShcIm1lcmlkaWVtXCIsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoaG91ciA+IDEyKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmVuZC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChyZXN1bHQuZW5kLmRhdGUoKS5nZXRUaW1lKCkgPCByZXN1bHQuc3RhcnQuZGF0ZSgpLmdldFRpbWUoKSkge1xuICAgICAgICAgICAgcmVzdWx0LmVuZC5pbXBseShcImRheVwiLCByZXN1bHQuZW5kLmdldChcImRheVwiKSArIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9WkhIYW5zVGltZUV4cHJlc3Npb25QYXJzZXIuanMubWFwIiwiaW1wb3J0IHsgQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5Q2hlY2tpbmcgfSBmcm9tIFwiLi4vLi4vLi4vLi4vY29tbW9uL3BhcnNlcnMvQWJzdHJhY3RQYXJzZXJXaXRoV29yZEJvdW5kYXJ5LmpzXCI7XG5pbXBvcnQgeyBXRUVLREFZX09GRlNFVCB9IGZyb20gXCIuLi9jb25zdGFudHMuanNcIjtcbmNvbnN0IFBBVFRFUk4gPSBuZXcgUmVnRXhwKFwiKD865pif5pyffOekvOaLnHzlkagpKD88d2Vla2RheT5cIiArIE9iamVjdC5rZXlzKFdFRUtEQVlfT0ZGU0VUKS5qb2luKFwifFwiKSArIFwiKVwiKTtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpISGFuc1dlZWtkYXlQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKCkge1xuICAgICAgICByZXR1cm4gUEFUVEVSTjtcbiAgICB9XG4gICAgaW5uZXJFeHRyYWN0KGNvbnRleHQsIG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbnRleHQuY3JlYXRlUGFyc2luZ1Jlc3VsdChtYXRjaC5pbmRleCwgbWF0Y2hbMF0pO1xuICAgICAgICBjb25zdCBkYXlPZldlZWsgPSBtYXRjaC5ncm91cHMud2Vla2RheTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gV0VFS0RBWV9PRkZTRVRbZGF5T2ZXZWVrXTtcbiAgICAgICAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShjb250ZXh0LnJlZkRhdGUuZ2V0VGltZSgpKTtcbiAgICAgICAgY29uc3Qgc3RhcnRNb21lbnRGaXhlZCA9IGZhbHNlO1xuICAgICAgICBjb25zdCByZWZPZmZzZXQgPSBkYXRlLmdldERheSgpO1xuICAgICAgICBsZXQgZGlmZiA9IG9mZnNldCAtIHJlZk9mZnNldDtcbiAgICAgICAgaWYgKE1hdGguYWJzKGRpZmYgLSA3KSA8IE1hdGguYWJzKGRpZmYpKSB7XG4gICAgICAgICAgICBkaWZmIC09IDc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKE1hdGguYWJzKGRpZmYgKyA3KSA8IE1hdGguYWJzKGRpZmYpKSB7XG4gICAgICAgICAgICBkaWZmICs9IDc7XG4gICAgICAgIH1cbiAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgZGlmZik7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ3ZWVrZGF5XCIsIG9mZnNldCk7XG4gICAgICAgIGlmIChzdGFydE1vbWVudEZpeGVkKSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwiZGF5XCIsIGRhdGUuZ2V0RGF0ZSgpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJtb250aFwiLCBkYXRlLmdldE1vbnRoKCkgKyAxKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNXZWVrZGF5UGFyc2VyLmpzLm1hcCIsImltcG9ydCB7IEFic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeUNoZWNraW5nIH0gZnJvbSBcIi4uLy4uLy4uLy4uL2NvbW1vbi9wYXJzZXJzL0Fic3RyYWN0UGFyc2VyV2l0aFdvcmRCb3VuZGFyeS5qc1wiO1xuY29uc3QgTk9XX0dST1VQID0gMTtcbmNvbnN0IERBWV9HUk9VUF8xID0gMjtcbmNvbnN0IFRJTUVfR1JPVVBfMSA9IDM7XG5jb25zdCBUSU1FX0dST1VQXzIgPSA0O1xuY29uc3QgREFZX0dST1VQXzMgPSA1O1xuY29uc3QgVElNRV9HUk9VUF8zID0gNjtcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFpISGFuc0Nhc3VhbERhdGVQYXJzZXIgZXh0ZW5kcyBBYnN0cmFjdFBhcnNlcldpdGhXb3JkQm91bmRhcnlDaGVja2luZyB7XG4gICAgaW5uZXJQYXR0ZXJuKGNvbnRleHQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoXCIo546w5ZyofOeriyg/OuWIu3zljbMpfOWNs+WIuyl8XCIgK1xuICAgICAgICAgICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSjml6l85pmaKXxcIiArXG4gICAgICAgICAgICBcIijkuIooPzrljYgpfOaXqSg/OuS4iil85LiLKD865Y2IKXzmmZooPzrkuIopfOWknCg/OuaZmik/fOS4rSg/OuWNiCl85YeMKD865pmoKSl8XCIgK1xuICAgICAgICAgICAgXCIo5LuKfOaYjnzliY185aSn5YmNfOWQjnzlpKflkI585pioKSg/OuaXpXzlpKkpXCIgK1xuICAgICAgICAgICAgXCIoPzpbXFxcXHN8LHzvvIxdKilcIiArXG4gICAgICAgICAgICBcIig/OijkuIooPzrljYgpfOaXqSg/OuS4iil85LiLKD865Y2IKXzmmZooPzrkuIopfOWknCg/OuaZmik/fOS4rSg/OuWNiCl85YeMKD865pmoKSkpP1wiLCBcImlcIik7XG4gICAgfVxuICAgIGlubmVyRXh0cmFjdChjb250ZXh0LCBtYXRjaCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IG1hdGNoLmluZGV4O1xuICAgICAgICBjb25zdCByZXN1bHQgPSBjb250ZXh0LmNyZWF0ZVBhcnNpbmdSZXN1bHQoaW5kZXgsIG1hdGNoWzBdKTtcbiAgICAgICAgY29uc3QgcmVmRGF0ZSA9IGNvbnRleHQucmVmRGF0ZTtcbiAgICAgICAgbGV0IGRhdGUgPSBuZXcgRGF0ZShyZWZEYXRlLmdldFRpbWUoKSk7XG4gICAgICAgIGlmIChtYXRjaFtOT1dfR1JPVVBdKSB7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIHJlZkRhdGUuZ2V0SG91cnMoKSk7XG4gICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtaW51dGVcIiwgcmVmRGF0ZS5nZXRNaW51dGVzKCkpO1xuICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwic2Vjb25kXCIsIHJlZkRhdGUuZ2V0U2Vjb25kcygpKTtcbiAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1pbGxpc2Vjb25kXCIsIHJlZkRhdGUuZ2V0TWlsbGlzZWNvbmRzKCkpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1hdGNoW0RBWV9HUk9VUF8xXSkge1xuICAgICAgICAgICAgY29uc3QgZGF5MSA9IG1hdGNoW0RBWV9HUk9VUF8xXTtcbiAgICAgICAgICAgIGNvbnN0IHRpbWUxID0gbWF0Y2hbVElNRV9HUk9VUF8xXTtcbiAgICAgICAgICAgIGlmIChkYXkxID09IFwi5piOXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAocmVmRGF0ZS5nZXRIb3VycygpID4gMSkge1xuICAgICAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5pioXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLliY1cIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSAtIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MSA9PSBcIuWkp+WJjVwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkxID09IFwi5ZCOXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgKyAyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTEgPT0gXCLlpKflkI5cIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRpbWUxID09IFwi5pepXCIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTEgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMjIpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKG1hdGNoW1RJTUVfR1JPVVBfMl0pIHtcbiAgICAgICAgICAgIGNvbnN0IHRpbWVTdHJpbmcyID0gbWF0Y2hbVElNRV9HUk9VUF8yXTtcbiAgICAgICAgICAgIGNvbnN0IHRpbWUyID0gdGltZVN0cmluZzJbMF07XG4gICAgICAgICAgICBpZiAodGltZTIgPT0gXCLml6lcIiB8fCB0aW1lMiA9PSBcIuS4ilwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCA2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUyID09IFwi5LiLXCIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDE1KTtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUyID09IFwi5LitXCIpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDEyKTtcbiAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJtZXJpZGllbVwiLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUyID09IFwi5aScXCIgfHwgdGltZTIgPT0gXCLmmZpcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMjIpO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAodGltZTIgPT0gXCLlh4xcIikge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWF0Y2hbREFZX0dST1VQXzNdKSB7XG4gICAgICAgICAgICBjb25zdCBkYXkzID0gbWF0Y2hbREFZX0dST1VQXzNdO1xuICAgICAgICAgICAgaWYgKGRheTMgPT0gXCLmmI5cIikge1xuICAgICAgICAgICAgICAgIGlmIChyZWZEYXRlLmdldEhvdXJzKCkgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLmmKhcIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWJjVwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpIC0gMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkYXkzID09IFwi5aSn5YmNXCIpIHtcbiAgICAgICAgICAgICAgICBkYXRlLnNldERhdGUoZGF0ZS5nZXREYXRlKCkgLSAzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKGRheTMgPT0gXCLlkI5cIikge1xuICAgICAgICAgICAgICAgIGRhdGUuc2V0RGF0ZShkYXRlLmdldERhdGUoKSArIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoZGF5MyA9PSBcIuWkp+WQjlwiKSB7XG4gICAgICAgICAgICAgICAgZGF0ZS5zZXREYXRlKGRhdGUuZ2V0RGF0ZSgpICsgMyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0aW1lU3RyaW5nMyA9IG1hdGNoW1RJTUVfR1JPVVBfM107XG4gICAgICAgICAgICBpZiAodGltZVN0cmluZzMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0aW1lMyA9IHRpbWVTdHJpbmczWzBdO1xuICAgICAgICAgICAgICAgIGlmICh0aW1lMyA9PSBcIuaXqVwiIHx8IHRpbWUzID09IFwi5LiKXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCA2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAodGltZTMgPT0gXCLkuItcIikge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuc3RhcnQuaW1wbHkoXCJob3VyXCIsIDE1KTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwibWVyaWRpZW1cIiwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHRpbWUzID09IFwi5LitXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAxMik7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aW1lMyA9PSBcIuWknFwiIHx8IHRpbWUzID09IFwi5pmaXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnN0YXJ0LmltcGx5KFwiaG91clwiLCAyMik7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcIm1lcmlkaWVtXCIsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0aW1lMyA9PSBcIuWHjFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5zdGFydC5pbXBseShcImhvdXJcIiwgMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJkYXlcIiwgZGF0ZS5nZXREYXRlKCkpO1xuICAgICAgICByZXN1bHQuc3RhcnQuYXNzaWduKFwibW9udGhcIiwgZGF0ZS5nZXRNb250aCgpICsgMSk7XG4gICAgICAgIHJlc3VsdC5zdGFydC5hc3NpZ24oXCJ5ZWFyXCIsIGRhdGUuZ2V0RnVsbFllYXIoKSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9WkhIYW5zQ2FzdWFsRGF0ZVBhcnNlci5qcy5tYXAiLCJpbXBvcnQgQWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIgZnJvbSBcIi4uLy4uLy4uLy4uL2NvbW1vbi9yZWZpbmVycy9BYnN0cmFjdE1lcmdlRGF0ZVJhbmdlUmVmaW5lci5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyIGV4dGVuZHMgQWJzdHJhY3RNZXJnZURhdGVSYW5nZVJlZmluZXIge1xuICAgIHBhdHRlcm5CZXR3ZWVuKCkge1xuICAgICAgICByZXR1cm4gL15cXHMqKOiHs3zliLB8LXx+fO+9nnzvvI1844O8KVxccyokL2k7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9WkhIYW5zTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzLm1hcCIsImltcG9ydCBBYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyIGZyb20gXCIuLi8uLi8uLi8uLi9jb21tb24vcmVmaW5lcnMvQWJzdHJhY3RNZXJnZURhdGVUaW1lUmVmaW5lci5qc1wiO1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgWkhIYW5zTWVyZ2VEYXRlVGltZVJlZmluZXIgZXh0ZW5kcyBBYnN0cmFjdE1lcmdlRGF0ZVRpbWVSZWZpbmVyIHtcbiAgICBwYXR0ZXJuQmV0d2VlbigpIHtcbiAgICAgICAgcmV0dXJuIC9eXFxzKiQvaTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1aSEhhbnNNZXJnZURhdGVUaW1lUmVmaW5lci5qcy5tYXAiLCJpbXBvcnQgRXh0cmFjdFRpbWV6b25lT2Zmc2V0UmVmaW5lciBmcm9tIFwiLi4vLi4vLi4vY29tbW9uL3JlZmluZXJzL0V4dHJhY3RUaW1lem9uZU9mZnNldFJlZmluZXIuanNcIjtcbmltcG9ydCB7IGluY2x1ZGVDb21tb25Db25maWd1cmF0aW9uIH0gZnJvbSBcIi4uLy4uLy4uL2NvbmZpZ3VyYXRpb25zLmpzXCI7XG5pbXBvcnQgeyBDaHJvbm8gfSBmcm9tIFwiLi4vLi4vLi4vY2hyb25vLmpzXCI7XG5pbXBvcnQgeyBQYXJzaW5nUmVzdWx0LCBQYXJzaW5nQ29tcG9uZW50cywgUmVmZXJlbmNlV2l0aFRpbWV6b25lIH0gZnJvbSBcIi4uLy4uLy4uL3Jlc3VsdHMuanNcIjtcbmltcG9ydCB7IE1lcmlkaWVtLCBXZWVrZGF5IH0gZnJvbSBcIi4uLy4uLy4uL3R5cGVzLmpzXCI7XG5pbXBvcnQgWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL1pISGFuc0Nhc3VhbERhdGVQYXJzZXIuanNcIjtcbmltcG9ydCBaSEhhbnNEYXRlUGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zRGF0ZVBhcnNlci5qc1wiO1xuaW1wb3J0IFpISGFuc0RlYWRsaW5lRm9ybWF0UGFyc2VyIGZyb20gXCIuL3BhcnNlcnMvWkhIYW5zRGVhZGxpbmVGb3JtYXRQYXJzZXIuanNcIjtcbmltcG9ydCBaSEhhbnNSZWxhdGlvbldlZWtkYXlQYXJzZXIgZnJvbSBcIi4vcGFyc2Vycy9aSEhhbnNSZWxhdGlvbldlZWtkYXlQYXJzZXIuanNcIjtcbmltcG9ydCBaSEhhbnNUaW1lRXhwcmVzc2lvblBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL1pISGFuc1RpbWVFeHByZXNzaW9uUGFyc2VyLmpzXCI7XG5pbXBvcnQgWkhIYW5zV2Vla2RheVBhcnNlciBmcm9tIFwiLi9wYXJzZXJzL1pISGFuc1dlZWtkYXlQYXJzZXIuanNcIjtcbmltcG9ydCBaSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIgZnJvbSBcIi4vcmVmaW5lcnMvWkhIYW5zTWVyZ2VEYXRlUmFuZ2VSZWZpbmVyLmpzXCI7XG5pbXBvcnQgWkhIYW5zTWVyZ2VEYXRlVGltZVJlZmluZXIgZnJvbSBcIi4vcmVmaW5lcnMvWkhIYW5zTWVyZ2VEYXRlVGltZVJlZmluZXIuanNcIjtcbmV4cG9ydCB7IENocm9ubywgUGFyc2luZ1Jlc3VsdCwgUGFyc2luZ0NvbXBvbmVudHMsIFJlZmVyZW5jZVdpdGhUaW1lem9uZSB9O1xuZXhwb3J0IHsgTWVyaWRpZW0sIFdlZWtkYXkgfTtcbmV4cG9ydCBjb25zdCBoYW5zID0gbmV3IENocm9ubyhjcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCkpO1xuZXhwb3J0IGNvbnN0IGNhc3VhbCA9IG5ldyBDaHJvbm8oY3JlYXRlQ2FzdWFsQ29uZmlndXJhdGlvbigpKTtcbmV4cG9ydCBjb25zdCBzdHJpY3QgPSBuZXcgQ2hyb25vKGNyZWF0ZUNvbmZpZ3VyYXRpb24oKSk7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2UodGV4dCwgcmVmLCBvcHRpb24pIHtcbiAgICByZXR1cm4gY2FzdWFsLnBhcnNlKHRleHQsIHJlZiwgb3B0aW9uKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZURhdGUodGV4dCwgcmVmLCBvcHRpb24pIHtcbiAgICByZXR1cm4gY2FzdWFsLnBhcnNlRGF0ZSh0ZXh0LCByZWYsIG9wdGlvbik7XG59XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2FzdWFsQ29uZmlndXJhdGlvbigpIHtcbiAgICBjb25zdCBvcHRpb24gPSBjcmVhdGVDb25maWd1cmF0aW9uKCk7XG4gICAgb3B0aW9uLnBhcnNlcnMudW5zaGlmdChuZXcgWkhIYW5zQ2FzdWFsRGF0ZVBhcnNlcigpKTtcbiAgICByZXR1cm4gb3B0aW9uO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNvbmZpZ3VyYXRpb24oKSB7XG4gICAgY29uc3QgY29uZmlndXJhdGlvbiA9IGluY2x1ZGVDb21tb25Db25maWd1cmF0aW9uKHtcbiAgICAgICAgcGFyc2VyczogW1xuICAgICAgICAgICAgbmV3IFpISGFuc0RhdGVQYXJzZXIoKSxcbiAgICAgICAgICAgIG5ldyBaSEhhbnNSZWxhdGlvbldlZWtkYXlQYXJzZXIoKSxcbiAgICAgICAgICAgIG5ldyBaSEhhbnNXZWVrZGF5UGFyc2VyKCksXG4gICAgICAgICAgICBuZXcgWkhIYW5zVGltZUV4cHJlc3Npb25QYXJzZXIoKSxcbiAgICAgICAgICAgIG5ldyBaSEhhbnNEZWFkbGluZUZvcm1hdFBhcnNlcigpLFxuICAgICAgICBdLFxuICAgICAgICByZWZpbmVyczogW25ldyBaSEhhbnNNZXJnZURhdGVSYW5nZVJlZmluZXIoKSwgbmV3IFpISGFuc01lcmdlRGF0ZVRpbWVSZWZpbmVyKCldLFxuICAgIH0pO1xuICAgIGNvbmZpZ3VyYXRpb24ucmVmaW5lcnMgPSBjb25maWd1cmF0aW9uLnJlZmluZXJzLmZpbHRlcigocmVmaW5lcikgPT4gIShyZWZpbmVyIGluc3RhbmNlb2YgRXh0cmFjdFRpbWV6b25lT2Zmc2V0UmVmaW5lcikpO1xuICAgIHJldHVybiBjb25maWd1cmF0aW9uO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXguanMubWFwIiwiLyoqXG4gKiDkuK3mlofml6XmnJ/or43lupPvvJrluo/mlbDor43jgIHmmJ/mnJ/jgIHnm7jlr7nml6XmnJ/jgIHnibnmrorml6XmnJ/vvIjlkKvnuYHnroDkvZPvvIlcbiAqL1xuXG4vLyAtLS0tIOW6j+aVsOivjSAtLS0tXG5leHBvcnQgY29uc3QgWkhfT1JESU5BTFM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFwi5LiAXCI6IDEsIFwi5LqMXCI6IDIsIFwi5LiJXCI6IDMsIFwi5ZubXCI6IDQsIFwi5LqUXCI6IDUsXG4gIFwi5YWtXCI6IDYsIFwi5LiDXCI6IDcsIFwi5YWrXCI6IDgsIFwi5LmdXCI6IDksIFwi5Y2BXCI6IDEwLFxuICBcIuWNgeS4gFwiOiAxMSwgXCLljYHkuoxcIjogMTIsIFwi5Y2B5LiJXCI6IDEzLCBcIuWNgeWbm1wiOiAxNCwgXCLljYHkupRcIjogMTUsXG4gIFwi5Y2B5YWtXCI6IDE2LCBcIuWNgeS4g1wiOiAxNywgXCLljYHlhatcIjogMTgsIFwi5Y2B5LmdXCI6IDE5LCBcIuS6jOWNgVwiOiAyMCxcbiAgXCLkuozljYHkuIBcIjogMjEsIFwi5LqM5Y2B5LqMXCI6IDIyLCBcIuS6jOWNgeS4iVwiOiAyMywgXCLkuozljYHlm5tcIjogMjQsIFwi5LqM5Y2B5LqUXCI6IDI1LFxuICBcIuS6jOWNgeWFrVwiOiAyNiwgXCLkuozljYHkuINcIjogMjcsIFwi5LqM5Y2B5YWrXCI6IDI4LCBcIuS6jOWNgeS5nVwiOiAyOSwgXCLkuInljYFcIjogMzAsXG4gIFwi5LiJ5Y2B5LiAXCI6IDMxLFxufTtcblxuLy8gLS0tLSDmmJ/mnJ8gLS0tLVxuZXhwb3J0IGNvbnN0IFpIX1dFRUtEQVlTX0xPTkcgPSBbXG4gIFwi5pif5pyf5LiAXCIsIFwi5pif5pyf5LqMXCIsIFwi5pif5pyf5LiJXCIsIFwi5pif5pyf5ZubXCIsIFwi5pif5pyf5LqUXCIsIFwi5pif5pyf5YWtXCIsIFwi5pif5pyf5pelXCIsXG5dO1xuXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWVNfU0hPUlQgPSBbXG4gIFwi5ZGo5LiAXCIsIFwi5ZGo5LqMXCIsIFwi5ZGo5LiJXCIsIFwi5ZGo5ZubXCIsIFwi5ZGo5LqUXCIsIFwi5ZGo5YWtXCIsIFwi5ZGo5pelXCIsXG4gIFwi6YCx5LiAXCIsIFwi6YCx5LqMXCIsIFwi6YCx5LiJXCIsIFwi6YCx5ZubXCIsIFwi6YCx5LqUXCIsIFwi6YCx5YWtXCIsIFwi6YCx5pelXCIsXG5dO1xuXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWVNfQUxUID0gW1xuICBcIuekvOaLnOS4gFwiLCBcIuekvOaLnOS6jFwiLCBcIuekvOaLnOS4iVwiLCBcIuekvOaLnOWbm1wiLCBcIuekvOaLnOS6lFwiLCBcIuekvOaLnOWFrVwiLCBcIuekvOaLnOWkqVwiLFxuICBcIuemruaLnOS4gFwiLCBcIuemruaLnOS6jFwiLCBcIuemruaLnOS4iVwiLCBcIuemruaLnOWbm1wiLCBcIuemruaLnOS6lFwiLCBcIuemruaLnOWFrVwiLCBcIuemruaLnOWkqVwiLFxuXTtcblxuLy8g5pif5pyf5ZCN56ewIOKGkiDluo/lj7fvvIgwPVN1bmRheSDlr7nlupQgbW9tZW5077yJXG5leHBvcnQgY29uc3QgWkhfV0VFS0RBWV9UT19OVU06IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIC8vIOeugOS9k1xuICBcIuaYn+acn+S4gFwiOiAxLCBcIuaYn+acn+S6jFwiOiAyLCBcIuaYn+acn+S4iVwiOiAzLCBcIuaYn+acn+Wbm1wiOiA0LCBcIuaYn+acn+S6lFwiOiA1LCBcIuaYn+acn+WFrVwiOiA2LCBcIuaYn+acn+aXpVwiOiAwLFxuICBcIuWRqOS4gFwiOiAxLCBcIuWRqOS6jFwiOiAyLCBcIuWRqOS4iVwiOiAzLCBcIuWRqOWbm1wiOiA0LCBcIuWRqOS6lFwiOiA1LCBcIuWRqOWFrVwiOiA2LCBcIuWRqOaXpVwiOiAwLFxuICBcIuekvOaLnOS4gFwiOiAxLCBcIuekvOaLnOS6jFwiOiAyLCBcIuekvOaLnOS4iVwiOiAzLCBcIuekvOaLnOWbm1wiOiA0LCBcIuekvOaLnOS6lFwiOiA1LCBcIuekvOaLnOWFrVwiOiA2LCBcIuekvOaLnOWkqVwiOiAwLFxuICAvLyDnuYHpq5RcbiAgXCLpgLHkuIBcIjogMSwgXCLpgLHkuoxcIjogMiwgXCLpgLHkuIlcIjogMywgXCLpgLHlm5tcIjogNCwgXCLpgLHkupRcIjogNSwgXCLpgLHlha1cIjogNiwgXCLpgLHml6VcIjogMCxcbiAgXCLnpq7mi5zkuIBcIjogMSwgXCLnpq7mi5zkuoxcIjogMiwgXCLnpq7mi5zkuIlcIjogMywgXCLnpq7mi5zlm5tcIjogNCwgXCLnpq7mi5zkupRcIjogNSwgXCLnpq7mi5zlha1cIjogNiwgXCLnpq7mi5zlpKlcIjogMCxcbn07XG5cbi8vIC0tLS0g55u45a+55pel5pyfIC0tLS1cbmV4cG9ydCBjb25zdCBaSF9SRUxBVElWRV9EQVlTOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICAvLyDnroDkvZNcbiAgXCLku4rlpKlcIjogMCxcbiAgXCLku4rml6VcIjogMCxcbiAgXCLmmI7lpKlcIjogMSxcbiAgXCLmmI7ml6VcIjogMSxcbiAgXCLlkI7lpKlcIjogMixcbiAgXCLlpKflkI7lpKlcIjogMyxcbiAgXCLmmKjlpKlcIjogLTEsXG4gIFwi5pio5pelXCI6IC0xLFxuICBcIuWJjeWkqVwiOiAtMixcbiAgXCLlpKfliY3lpKlcIjogLTMsXG4gIC8vIOe5gemrlFxuICBcIuW+jOWkqVwiOiAyLFxuICBcIuWkp+W+jOWkqVwiOiAzLFxufTtcblxuLy8gLS0tLSDlkajmnJ/mjIfnpLror40gLS0tLVxuZXhwb3J0IGNvbnN0IFpIX1RISVMgPSBbXCLov5nkuKpcIiwgXCLov5lcIiwgXCLmnKxcIiwgXCLpgJnlgItcIiwgXCLpgJlcIl07XG5leHBvcnQgY29uc3QgWkhfTkVYVCA9IFtcIuS4i+S4qlwiLCBcIuS4i1wiLCBcIuadpVwiLCBcIuS4i+WAi1wiLCBcIuS+hlwiXTtcbmV4cG9ydCBjb25zdCBaSF9MQVNUID0gW1wi5LiK5LiqXCIsIFwi5LiKXCIsIFwi5Y67XCIsIFwi5LiK5YCLXCJdO1xuXG4vLyAtLS0tIOWRqOacn+WNleS9jSAtLS0tXG5leHBvcnQgY29uc3QgWkhfV0VFS19XT1JEUyA9IFtcIuWRqFwiLCBcIuaYn+acn1wiLCBcIuekvOaLnFwiLCBcIumAsVwiLCBcIuemruaLnFwiXTtcbmV4cG9ydCBjb25zdCBaSF9NT05USF9XT1JEUyA9IFtcIuaciFwiLCBcIuaciOS7vVwiXTtcbmV4cG9ydCBjb25zdCBaSF9ZRUFSX1dPUkRTID0gW1wi5bm0XCJdO1xuXG4vLyAtLS0tIOaciOS7veWQjeensCAtLS0tXG5leHBvcnQgY29uc3QgWkhfTU9OVEhTOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0ge1xuICBcIuS4gOaciFwiOiAxLCBcIuS6jOaciFwiOiAyLCBcIuS4ieaciFwiOiAzLCBcIuWbm+aciFwiOiA0LCBcIuS6lOaciFwiOiA1LCBcIuWFreaciFwiOiA2LFxuICBcIuS4g+aciFwiOiA3LCBcIuWFq+aciFwiOiA4LCBcIuS5neaciFwiOiA5LCBcIuWNgeaciFwiOiAxMCwgXCLljYHkuIDmnIhcIjogMTEsIFwi5Y2B5LqM5pyIXCI6IDEyLFxuICBcIjHmnIhcIjogMSwgXCIy5pyIXCI6IDIsIFwiM+aciFwiOiAzLCBcIjTmnIhcIjogNCwgXCI15pyIXCI6IDUsIFwiNuaciFwiOiA2LFxuICBcIjfmnIhcIjogNywgXCI45pyIXCI6IDgsIFwiOeaciFwiOiA5LCBcIjEw5pyIXCI6IDEwLCBcIjEx5pyIXCI6IDExLCBcIjEy5pyIXCI6IDEyLFxufTtcblxuLy8gLS0tLSDnibnmrorkvY3nva4gLS0tLVxuZXhwb3J0IGNvbnN0IFpIX1BPU0lUSU9OID0ge1xuICBlbmRPZk1vbnRoOiBbXCLmnIjlupVcIiwgXCLmnIjmnKtcIl0sXG4gIG1pZE9mTW9udGg6IFtcIuaciOS4rVwiXSxcbiAgc3RhcnRPZk1vbnRoOiBbXCLmnIjliJ1cIl0sXG4gIGVuZE9mWWVhcjogW1wi5bm05bqVXCIsIFwi5bm05pyrXCIsIFwi5bm057uIXCIsIFwi5bm057WCXCJdLFxuICBzdGFydE9mWWVhcjogW1wi5bm05YidXCJdLFxufTtcblxuLy8gLS0tLSDnibnmrorlhazljobml6XmnJ8gLS0tLVxuZXhwb3J0IGNvbnN0IFpIX1NQRUNJQUxfREFURVM6IFJlY29yZDxzdHJpbmcsIHsgbW9udGg6IG51bWJlcjsgZGF5OiBudW1iZXIgfT4gPSB7XG4gIC8vIOeugOS9k1xuICBcIuWFg+aXplwiOiB7IG1vbnRoOiAxLCBkYXk6IDEgfSxcbiAgXCLlirPliqjoioJcIjogeyBtb250aDogNSwgZGF5OiAxIH0sXG4gIFwi5LqU5LiAXCI6IHsgbW9udGg6IDUsIGRheTogMSB9LFxuICBcIuS6lOWbm1wiOiB7IG1vbnRoOiA1LCBkYXk6IDQgfSxcbiAgXCLlha3kuIBcIjogeyBtb250aDogNiwgZGF5OiAxIH0sXG4gIFwi5LiD5LiAXCI6IHsgbW9udGg6IDcsIGRheTogMSB9LFxuICBcIuWFq+S4gFwiOiB7IG1vbnRoOiA4LCBkYXk6IDEgfSxcbiAgXCLlm73luoZcIjogeyBtb250aDogMTAsIGRheTogMSB9LFxuICBcIuWNgeS4gFwiOiB7IG1vbnRoOiAxMCwgZGF5OiAxIH0sXG4gIFwi5Zyj6K+eXCI6IHsgbW9udGg6IDEyLCBkYXk6IDI1IH0sXG4gIFwi5Zyj6K+e6IqCXCI6IHsgbW9udGg6IDEyLCBkYXk6IDI1IH0sXG4gIFwi5bmz5a6J5aScXCI6IHsgbW9udGg6IDEyLCBkYXk6IDI0IH0sXG4gIFwi5oOF5Lq66IqCXCI6IHsgbW9udGg6IDIsIGRheTogMTQgfSxcbiAgXCLmhJrkurroioJcIjogeyBtb250aDogNCwgZGF5OiAxIH0sXG4gIFwi5LiH5Zyj6IqCXCI6IHsgbW9udGg6IDEwLCBkYXk6IDMxIH0sXG4gIFwi5oSf5oGp6IqCXCI6IHsgbW9udGg6IDExLCBkYXk6IDI3IH0sXG4gIFwi6YeN6ZizXCI6IHsgbW9udGg6IDEwLCBkYXk6IDkgfSxcbiAgLy8g57mB6auUXG4gIFwi5Yue5YuV56+AXCI6IHsgbW9udGg6IDUsIGRheTogMSB9LFxuICBcIuWci+aFtlwiOiB7IG1vbnRoOiAxMCwgZGF5OiAxIH0sXG4gIFwi6IGW6KqVXCI6IHsgbW9udGg6IDEyLCBkYXk6IDI1IH0sXG4gIFwi6IGW6KqV56+AXCI6IHsgbW9udGg6IDEyLCBkYXk6IDI1IH0sXG4gIFwi5oOF5Lq656+AXCI6IHsgbW9udGg6IDIsIGRheTogMTQgfSxcbiAgXCLmhJrkurrnr4BcIjogeyBtb250aDogNCwgZGF5OiAxIH0sXG4gIFwi6JCs6IGW56+AXCI6IHsgbW9udGg6IDEwLCBkYXk6IDMxIH0sXG4gIFwi5oSf5oGp56+AXCI6IHsgbW9udGg6IDExLCBkYXk6IDI3IH0sXG4gIFwi6YeN6Zm9XCI6IHsgbW9udGg6IDEwLCBkYXk6IDkgfSxcbiAgLy8g5Yac5Y6G6L+R5Ly8XG4gIFwi6Zmk5aSVXCI6IHsgbW9udGg6IDEsIGRheTogMjggfSxcbiAgXCLlhYPlrrVcIjogeyBtb250aDogMiwgZGF5OiAxMiB9LFxuICBcIuerr+WNiFwiOiB7IG1vbnRoOiA2LCBkYXk6IDEgfSxcbiAgXCLkuK3np4tcIjogeyBtb250aDogOSwgZGF5OiAxNSB9LFxuICBcIuS4g+WklVwiOiB7IG1vbnRoOiA4LCBkYXk6IDQgfSxcbn07XG5cbi8vIC0tLS0g5pWw6YeP5Y2V5L2N77yI55So5LqOIFjlpKnliY0v5ZCOIOexu+Wei++8iS0tLS1cbmV4cG9ydCBjb25zdCBaSF9OVU1CRVJfVU5JVFM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gIFwi5aSpXCI6IFwiZFwiLFxuICBcIuaXpVwiOiBcImRcIixcbiAgXCLlkahcIjogXCJ3XCIsXG4gIFwi6YCxXCI6IFwid1wiLFxuICBcIuaYn+acn1wiOiBcIndcIixcbiAgXCLnpLzmi5xcIjogXCJ3XCIsXG4gIFwi56au5oucXCI6IFwid1wiLFxuICBcIuaciFwiOiBcIk1cIixcbiAgXCLkuKrmnIhcIjogXCJNXCIsXG4gIFwi5YCL5pyIXCI6IFwiTVwiLFxuICBcIuW5tFwiOiBcInlcIixcbn07XG4iLCJpbXBvcnQgeyBub3JtYWxpemVQYXRoLCBOb3RpY2UsIFRGaWxlLCBURm9sZGVyLCBWYXVsdCB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG50eXBlIE1vbWVudEluc3RhbmNlID0gUmV0dXJuVHlwZTx0eXBlb2Ygd2luZG93Lm1vbWVudD47XG5cbmludGVyZmFjZSBJRm9sZCB7XG4gIGZyb206IG51bWJlcjtcbiAgdG86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElGb2xkSW5mbyB7XG4gIGZvbGRzOiBJRm9sZFtdO1xufVxuXG5pbnRlcmZhY2UgSVBlcmlvZGljTm90ZVNldHRpbmdzIHtcbiAgZm9sZGVyPzogc3RyaW5nO1xuICBmb3JtYXQ/OiBzdHJpbmc7XG4gIHRlbXBsYXRlPzogc3RyaW5nO1xufVxuXG50eXBlIElHcmFudWxhcml0eSA9IFwiZGF5XCIgfCBcIndlZWtcIiB8IFwibW9udGhcIiB8IFwicXVhcnRlclwiIHwgXCJ5ZWFyXCI7XG5cbmNvbnN0IERFRkFVTFRfREFJTFlfTk9URV9GT1JNQVQgPSBcIllZWVktTU0tRERcIjtcblxuaW50ZXJmYWNlIEFwcFdpdGhJbnRlcm5hbHMge1xuICB2YXVsdDogVmF1bHQ7XG4gIHBsdWdpbnM6IHtcbiAgICBnZXRQbHVnaW4oaWQ6IHN0cmluZyk6IHVua25vd247XG4gIH07XG4gIGludGVybmFsUGx1Z2luczoge1xuICAgIGdldFBsdWdpbkJ5SWQoXG4gICAgICBpZDogc3RyaW5nXG4gICAgKTogeyBpbnN0YW5jZT86IHsgb3B0aW9ucz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+IH0gfSB8IHVuZGVmaW5lZDtcbiAgfTtcbiAgZm9sZE1hbmFnZXI6IHtcbiAgICBzYXZlKGZpbGU6IFRGaWxlLCBmb2xkSW5mbzogSUZvbGRJbmZvKTogdm9pZDtcbiAgICBsb2FkKGZpbGU6IFRGaWxlKTogSUZvbGRJbmZvO1xuICB9O1xuICBtZXRhZGF0YUNhY2hlOiB7XG4gICAgZ2V0Rmlyc3RMaW5rcGF0aERlc3QobGlua3BhdGg6IHN0cmluZywgc291cmNlUGF0aDogc3RyaW5nKTogVEZpbGUgfCBudWxsO1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRBcHAoKTogQXBwV2l0aEludGVybmFscyB7XG4gIHJldHVybiAod2luZG93IGFzIHVua25vd24gYXMgeyBhcHA6IEFwcFdpdGhJbnRlcm5hbHMgfSkuYXBwO1xufVxuXG5mdW5jdGlvbiBzaG91bGRVc2VQZXJpb2RpY05vdGVzU2V0dGluZ3MocGVyaW9kaWNpdHk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBwbHVnaW4gPSBnZXRBcHAoKS5wbHVnaW5zLmdldFBsdWdpbihcInBlcmlvZGljLW5vdGVzXCIpIGFzXG4gICAgfCB7IHNldHRpbmdzPzogUmVjb3JkPHN0cmluZywgeyBlbmFibGVkPzogYm9vbGVhbiB9PiB9XG4gICAgfCB1bmRlZmluZWQ7XG4gIHJldHVybiBCb29sZWFuKHBsdWdpbj8uc2V0dGluZ3M/LltwZXJpb2RpY2l0eV0/LmVuYWJsZWQpO1xufVxuXG5mdW5jdGlvbiBnZXREYWlseU5vdGVTZXR0aW5ncygpOiBJUGVyaW9kaWNOb3RlU2V0dGluZ3Mge1xuICB0cnkge1xuICAgIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuXG4gICAgaWYgKHNob3VsZFVzZVBlcmlvZGljTm90ZXNTZXR0aW5ncyhcImRhaWx5XCIpKSB7XG4gICAgICBjb25zdCBwbHVnaW4gPSBhcHAucGx1Z2lucy5nZXRQbHVnaW4oXCJwZXJpb2RpYy1ub3Rlc1wiKSBhc1xuICAgICAgICB8IHtcbiAgICAgICAgICAgIHNldHRpbmdzPzoge1xuICAgICAgICAgICAgICBkYWlseT86IHsgZm9ybWF0Pzogc3RyaW5nOyBmb2xkZXI/OiBzdHJpbmc7IHRlbXBsYXRlPzogc3RyaW5nIH07XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfCB1bmRlZmluZWQ7XG4gICAgICBjb25zdCBkYWlseSA9IHBsdWdpbj8uc2V0dGluZ3M/LmRhaWx5IHx8IHt9O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZm9ybWF0OlxuICAgICAgICAgIHR5cGVvZiBkYWlseS5mb3JtYXQgPT09IFwic3RyaW5nXCJcbiAgICAgICAgICAgID8gZGFpbHkuZm9ybWF0XG4gICAgICAgICAgICA6IERFRkFVTFRfREFJTFlfTk9URV9GT1JNQVQsXG4gICAgICAgIGZvbGRlcjogdHlwZW9mIGRhaWx5LmZvbGRlciA9PT0gXCJzdHJpbmdcIiA/IGRhaWx5LmZvbGRlci50cmltKCkgOiBcIlwiLFxuICAgICAgICB0ZW1wbGF0ZTpcbiAgICAgICAgICB0eXBlb2YgZGFpbHkudGVtcGxhdGUgPT09IFwic3RyaW5nXCIgPyBkYWlseS50ZW1wbGF0ZS50cmltKCkgOiBcIlwiLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBwbHVnaW4gPSBhcHAuaW50ZXJuYWxQbHVnaW5zLmdldFBsdWdpbkJ5SWQoXCJkYWlseS1ub3Rlc1wiKTtcbiAgICBjb25zdCBvcHRpb25zID0gcGx1Z2luPy5pbnN0YW5jZT8ub3B0aW9ucyBhc1xuICAgICAgfCB7IGZvbGRlcj86IHN0cmluZzsgZm9ybWF0Pzogc3RyaW5nOyB0ZW1wbGF0ZT86IHN0cmluZyB9XG4gICAgICB8IHVuZGVmaW5lZDtcbiAgICByZXR1cm4ge1xuICAgICAgZm9ybWF0OlxuICAgICAgICB0eXBlb2Ygb3B0aW9ucz8uZm9ybWF0ID09PSBcInN0cmluZ1wiXG4gICAgICAgICAgPyBvcHRpb25zLmZvcm1hdFxuICAgICAgICAgIDogREVGQVVMVF9EQUlMWV9OT1RFX0ZPUk1BVCxcbiAgICAgIGZvbGRlcjogdHlwZW9mIG9wdGlvbnM/LmZvbGRlciA9PT0gXCJzdHJpbmdcIiA/IG9wdGlvbnMuZm9sZGVyLnRyaW0oKSA6IFwiXCIsXG4gICAgICB0ZW1wbGF0ZTpcbiAgICAgICAgdHlwZW9mIG9wdGlvbnM/LnRlbXBsYXRlID09PSBcInN0cmluZ1wiID8gb3B0aW9ucy50ZW1wbGF0ZS50cmltKCkgOiBcIlwiLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUud2FybihcIuaXoOazleivu+WPluaXpeiusOiuvue9rlwiLCBlcnIpO1xuICAgIHJldHVybiB7XG4gICAgICBmb3JtYXQ6IERFRkFVTFRfREFJTFlfTk9URV9GT1JNQVQsXG4gICAgICBmb2xkZXI6IFwiXCIsXG4gICAgICB0ZW1wbGF0ZTogXCJcIixcbiAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldERhdGVVSUQoXG4gIGRhdGU6IE1vbWVudEluc3RhbmNlLFxuICBncmFudWxhcml0eTogSUdyYW51bGFyaXR5ID0gXCJkYXlcIlxuKTogc3RyaW5nIHtcbiAgY29uc3QgdHMgPSBkYXRlLmNsb25lKCkuc3RhcnRPZihncmFudWxhcml0eSkuZm9ybWF0KCk7XG4gIHJldHVybiBgJHtncmFudWxhcml0eX0tJHt0c31gO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFc2NhcGVkQ2hhcmFjdGVycyhmb3JtYXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmb3JtYXQucmVwbGFjZSgvXFxbW15cXF1dKlxcXS9nLCBcIlwiKTtcbn1cblxuZnVuY3Rpb24gaXNGb3JtYXRBbWJpZ3VvdXMoXG4gIGZvcm1hdDogc3RyaW5nLFxuICBncmFudWxhcml0eTogSUdyYW51bGFyaXR5XG4pOiBib29sZWFuIHtcbiAgaWYgKGdyYW51bGFyaXR5ID09PSBcIndlZWtcIikge1xuICAgIGNvbnN0IGNsZWFuRm9ybWF0ID0gcmVtb3ZlRXNjYXBlZENoYXJhY3RlcnMoZm9ybWF0KTtcbiAgICByZXR1cm4gKFxuICAgICAgL3d7MSwyfS9pLnRlc3QoY2xlYW5Gb3JtYXQpICYmXG4gICAgICAoL017MSw0fS8udGVzdChjbGVhbkZvcm1hdCkgfHwgL0R7MSw0fS8udGVzdChjbGVhbkZvcm1hdCkpXG4gICAgKTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGdldERhdGVGcm9tRmlsZW5hbWUoXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIGdyYW51bGFyaXR5OiBJR3JhbnVsYXJpdHlcbik6IE1vbWVudEluc3RhbmNlIHwgbnVsbCB7XG4gIGNvbnN0IGdldFNldHRpbmdzOiBSZWNvcmQ8SUdyYW51bGFyaXR5LCAoKSA9PiBJUGVyaW9kaWNOb3RlU2V0dGluZ3M+ID0ge1xuICAgIGRheTogZ2V0RGFpbHlOb3RlU2V0dGluZ3MsXG4gICAgd2VlazogZ2V0RGFpbHlOb3RlU2V0dGluZ3MsXG4gICAgbW9udGg6IGdldERhaWx5Tm90ZVNldHRpbmdzLFxuICAgIHF1YXJ0ZXI6IGdldERhaWx5Tm90ZVNldHRpbmdzLFxuICAgIHllYXI6IGdldERhaWx5Tm90ZVNldHRpbmdzLFxuICB9O1xuXG4gIGNvbnN0IHNldHRpbmdGbiA9IGdldFNldHRpbmdzW2dyYW51bGFyaXR5XTtcbiAgY29uc3QgZm9ybWF0U2V0dGluZyA9XG4gICAgKHNldHRpbmdGbigpLmZvcm1hdCA/PyBcIlwiKS5zcGxpdChcIi9cIikucG9wKCkgfHxcbiAgICBERUZBVUxUX0RBSUxZX05PVEVfRk9STUFUO1xuICBjb25zdCBub3RlRGF0ZSA9IHdpbmRvdy5tb21lbnQoZmlsZW5hbWUsIGZvcm1hdFNldHRpbmcsIHRydWUpO1xuXG4gIGlmICghbm90ZURhdGUuaXNWYWxpZCgpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBpZiAoaXNGb3JtYXRBbWJpZ3VvdXMoZm9ybWF0U2V0dGluZywgZ3JhbnVsYXJpdHkpKSB7XG4gICAgaWYgKGdyYW51bGFyaXR5ID09PSBcIndlZWtcIikge1xuICAgICAgY29uc3QgY2xlYW5Gb3JtYXQgPSByZW1vdmVFc2NhcGVkQ2hhcmFjdGVycyhmb3JtYXRTZXR0aW5nKTtcbiAgICAgIGlmICgvd3sxLDJ9L2kudGVzdChjbGVhbkZvcm1hdCkpIHtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5tb21lbnQoXG4gICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgZm9ybWF0U2V0dGluZy5yZXBsYWNlKC9NezEsNH0vZywgXCJcIikucmVwbGFjZSgvRHsxLDR9L2csIFwiXCIpLFxuICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5vdGVEYXRlO1xufVxuXG5mdW5jdGlvbiBnZXREYXRlRnJvbUZpbGUoXG4gIGZpbGU6IFRGaWxlLFxuICBncmFudWxhcml0eTogSUdyYW51bGFyaXR5XG4pOiBNb21lbnRJbnN0YW5jZSB8IG51bGwge1xuICByZXR1cm4gZ2V0RGF0ZUZyb21GaWxlbmFtZShmaWxlLmJhc2VuYW1lLCBncmFudWxhcml0eSk7XG59XG5cbmZ1bmN0aW9uIGpvaW5QYXRocyguLi5zZWdtZW50czogc3RyaW5nW10pOiBzdHJpbmcge1xuICBjb25zdCBwYXJ0czogc3RyaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBzZWdtZW50IG9mIHNlZ21lbnRzKSB7XG4gICAgcGFydHMucHVzaCguLi5zZWdtZW50LnNwbGl0KFwiL1wiKSk7XG4gIH1cbiAgY29uc3QgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHBhcnQgb2YgcGFydHMpIHtcbiAgICBpZiAoIXBhcnQgfHwgcGFydCA9PT0gXCIuXCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChwYXJ0KTtcbiAgfVxuICBpZiAocGFydHNbMF0gPT09IFwiXCIpIHtcbiAgICByZXN1bHQudW5zaGlmdChcIlwiKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0LmpvaW4oXCIvXCIpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVGb2xkZXJFeGlzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGRpcnMgPSBwYXRoLnJlcGxhY2UoL1xcXFwvZywgXCIvXCIpLnNwbGl0KFwiL1wiKTtcbiAgZGlycy5wb3AoKTtcblxuICBpZiAoZGlycy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZGlyID0gam9pblBhdGhzKC4uLmRpcnMpO1xuICAgIGlmICghZ2V0QXBwKCkudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGRpcikpIHtcbiAgICAgIGF3YWl0IGdldEFwcCgpLnZhdWx0LmNyZWF0ZUZvbGRlcihkaXIpO1xuICAgIH1cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXROb3RlUGF0aChcbiAgZGlyZWN0b3J5OiBzdHJpbmcsXG4gIGZpbGVuYW1lOiBzdHJpbmdcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGxldCBuYW1lID0gZmlsZW5hbWU7XG4gIGlmICghbmFtZS5lbmRzV2l0aChcIi5tZFwiKSkge1xuICAgIG5hbWUgKz0gXCIubWRcIjtcbiAgfVxuICBjb25zdCBwYXRoID0gbm9ybWFsaXplUGF0aChqb2luUGF0aHMoZGlyZWN0b3J5LCBuYW1lKSk7XG4gIGF3YWl0IGVuc3VyZUZvbGRlckV4aXN0cyhwYXRoKTtcbiAgcmV0dXJuIHBhdGg7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFRlbXBsYXRlSW5mbyh0ZW1wbGF0ZTogc3RyaW5nKTogUHJvbWlzZTxbc3RyaW5nLCBJRm9sZEluZm9dPiB7XG4gIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuICBjb25zdCB0ZW1wbGF0ZVBhdGggPSBub3JtYWxpemVQYXRoKHRlbXBsYXRlKTtcbiAgaWYgKHRlbXBsYXRlUGF0aCA9PT0gXCIvXCIpIHtcbiAgICByZXR1cm4gW1wiXCIsIHsgZm9sZHM6IFtdIH1dO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB0ZW1wbGF0ZUZpbGUgPSBhcHAubWV0YWRhdGFDYWNoZS5nZXRGaXJzdExpbmtwYXRoRGVzdChcbiAgICAgIHRlbXBsYXRlUGF0aCxcbiAgICAgIFwiXCJcbiAgICApO1xuICAgIGlmICghdGVtcGxhdGVGaWxlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCLmqKHmnb/mlofku7bmnKrmib7liLBcIik7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgYXBwLnZhdWx0LmNhY2hlZFJlYWQodGVtcGxhdGVGaWxlKTtcbiAgICBjb25zdCBmb2xkSW5mbyA9IGFwcC5mb2xkTWFuYWdlci5sb2FkKHRlbXBsYXRlRmlsZSk7XG4gICAgcmV0dXJuIFtjb250ZW50cywgZm9sZEluZm9dO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKGDor7vlj5bml6XorrDmqKHmnb/lpLHotKUgJyR7dGVtcGxhdGVQYXRofSdgLCBlcnIpO1xuICAgIG5ldyBOb3RpY2UoXCLor7vlj5bml6XorrDmqKHmnb/lpLHotKVcIik7XG4gICAgcmV0dXJuIFtcIlwiLCB7IGZvbGRzOiBbXSB9XTtcbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlRGFpbHlOb3RlKFxuICBkYXRlOiBNb21lbnRJbnN0YW5jZVxuKTogUHJvbWlzZTxURmlsZT4ge1xuICBjb25zdCBhcHAgPSBnZXRBcHAoKTtcbiAgY29uc3QgeyB2YXVsdCB9ID0gYXBwO1xuXG4gIGNvbnN0IHsgdGVtcGxhdGUsIGZvcm1hdCwgZm9sZGVyIH0gPSBnZXREYWlseU5vdGVTZXR0aW5ncygpO1xuXG4gIGNvbnN0IFt0ZW1wbGF0ZUNvbnRlbnRzLCBmb2xkSW5mb10gPSBhd2FpdCBnZXRUZW1wbGF0ZUluZm8odGVtcGxhdGUgfHwgXCJcIik7XG4gIGNvbnN0IGZpbGVuYW1lID0gZGF0ZS5mb3JtYXQoZm9ybWF0KTtcbiAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBhd2FpdCBnZXROb3RlUGF0aChmb2xkZXIgfHwgXCJcIiwgZmlsZW5hbWUpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgY3JlYXRlZEZpbGUgPSBhd2FpdCB2YXVsdC5jcmVhdGUoXG4gICAgICBub3JtYWxpemVkUGF0aCxcbiAgICAgIHRlbXBsYXRlQ29udGVudHNcbiAgICAgICAgLnJlcGxhY2UoL3t7XFxzKmRhdGVcXHMqfX0vZ2ksIGZpbGVuYW1lKVxuICAgICAgICAucmVwbGFjZSgve3tcXHMqdGltZVxccyp9fS9naSwgd2luZG93Lm1vbWVudCgpLmZvcm1hdChcIkhIOm1tXCIpKVxuICAgICAgICAucmVwbGFjZSgve3tcXHMqdGl0bGVcXHMqfX0vZ2ksIGZpbGVuYW1lKVxuICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAve3tcXHMqKGRhdGV8dGltZSlcXHMqKChbKy1dXFxkKykoW3lxbXdkaHNdKSk/XFxzKig6Lis/KT99fS9naSxcbiAgICAgICAgICAoXG4gICAgICAgICAgICBfbWF0Y2g6IHN0cmluZyxcbiAgICAgICAgICAgIF90aW1lT3JEYXRlOiBzdHJpbmcsXG4gICAgICAgICAgICBjYWxjOiBzdHJpbmcsXG4gICAgICAgICAgICB0aW1lRGVsdGE6IHN0cmluZyxcbiAgICAgICAgICAgIHVuaXQ6IHN0cmluZyxcbiAgICAgICAgICAgIG1vbWVudEZvcm1hdDogc3RyaW5nXG4gICAgICAgICAgKTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5vdyA9IHdpbmRvdy5tb21lbnQoKTtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnREYXRlID0gZGF0ZS5jbG9uZSgpLnNldCh7XG4gICAgICAgICAgICAgIGhvdXI6IG5vdy5nZXQoXCJob3VyXCIpLFxuICAgICAgICAgICAgICBtaW51dGU6IG5vdy5nZXQoXCJtaW51dGVcIiksXG4gICAgICAgICAgICAgIHNlY29uZDogbm93LmdldChcInNlY29uZFwiKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKGNhbGMpIHtcbiAgICAgICAgICAgICAgY3VycmVudERhdGUuYWRkKHBhcnNlSW50KHRpbWVEZWx0YSwgMTApIGFzIG5ldmVyLCB1bml0IGFzIG5ldmVyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1vbWVudEZvcm1hdCkge1xuICAgICAgICAgICAgICByZXR1cm4gY3VycmVudERhdGUuZm9ybWF0KG1vbWVudEZvcm1hdC5zdWJzdHJpbmcoMSkudHJpbSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjdXJyZW50RGF0ZS5mb3JtYXQoZm9ybWF0KTtcbiAgICAgICAgICB9XG4gICAgICAgIClcbiAgICAgICAgLnJlcGxhY2UoXG4gICAgICAgICAgL3t7XFxzKnllc3RlcmRheVxccyp9fS9naSxcbiAgICAgICAgICBkYXRlLmNsb25lKCkuc3VidHJhY3QoMSwgXCJkYXlcIikuZm9ybWF0KGZvcm1hdClcbiAgICAgICAgKVxuICAgICAgICAucmVwbGFjZShcbiAgICAgICAgICAve3tcXHMqdG9tb3Jyb3dcXHMqfX0vZ2ksXG4gICAgICAgICAgZGF0ZS5jbG9uZSgpLmFkZCgxLCBcImRcIikuZm9ybWF0KGZvcm1hdClcbiAgICAgICAgKVxuICAgICk7XG5cbiAgICBhcHAuZm9sZE1hbmFnZXIuc2F2ZShjcmVhdGVkRmlsZSwgZm9sZEluZm8pO1xuXG4gICAgcmV0dXJuIGNyZWF0ZWRGaWxlO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKGDliJvlu7rmlofku7blpLHotKU6ICcke25vcm1hbGl6ZWRQYXRofSdgLCBlcnIpO1xuICAgIG5ldyBOb3RpY2UoXCLml6Dms5XliJvlu7rmlrDml6XorrDmlofku7ZcIik7XG4gICAgdGhyb3cgZXJyO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREYWlseU5vdGUoXG4gIGRhdGU6IE1vbWVudEluc3RhbmNlLFxuICBkYWlseU5vdGVzOiBSZWNvcmQ8c3RyaW5nLCBURmlsZT5cbik6IFRGaWxlIHwgbnVsbCB7XG4gIHJldHVybiBkYWlseU5vdGVzW2dldERhdGVVSUQoZGF0ZSwgXCJkYXlcIildID8/IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRBbGxEYWlseU5vdGVzKCk6IFJlY29yZDxzdHJpbmcsIFRGaWxlPiB7XG4gIGNvbnN0IGFwcCA9IGdldEFwcCgpO1xuICBjb25zdCB7IHZhdWx0IH0gPSBhcHA7XG4gIGNvbnN0IHsgZm9sZGVyIH0gPSBnZXREYWlseU5vdGVTZXR0aW5ncygpO1xuXG4gIGNvbnN0IGRhaWx5Tm90ZXNGb2xkZXIgPSB2YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoXG4gICAgbm9ybWFsaXplUGF0aChmb2xkZXIgfHwgXCJcIilcbiAgKSBhcyBURm9sZGVyIHwgbnVsbDtcblxuICBpZiAoIWRhaWx5Tm90ZXNGb2xkZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCLmnKrmib7liLDml6XorrDmlofku7blpLlcIik7XG4gIH1cblxuICBjb25zdCBkYWlseU5vdGVzOiBSZWNvcmQ8c3RyaW5nLCBURmlsZT4gPSB7fTtcbiAgVmF1bHQucmVjdXJzZUNoaWxkcmVuKGRhaWx5Tm90ZXNGb2xkZXIsIChub3RlKSA9PiB7XG4gICAgaWYgKG5vdGUgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgY29uc3Qgbm90ZURhdGUgPSBnZXREYXRlRnJvbUZpbGUobm90ZSwgXCJkYXlcIik7XG4gICAgICBpZiAobm90ZURhdGUpIHtcbiAgICAgICAgY29uc3QgZGF0ZVN0cmluZyA9IGdldERhdGVVSUQobm90ZURhdGUsIFwiZGF5XCIpO1xuICAgICAgICBkYWlseU5vdGVzW2RhdGVTdHJpbmddID0gbm90ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBkYWlseU5vdGVzO1xufVxuIiwiaW1wb3J0IHtcbiAgQXBwLFxuICBFZGl0b3IsXG4gIEVkaXRvclJhbmdlLFxuICBFZGl0b3JQb3NpdGlvbixcbiAgbm9ybWFsaXplUGF0aCxcbiAgVEZpbGUsXG4gIG1vbWVudCxcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBjcmVhdGVEYWlseU5vdGUsIGdldEFsbERhaWx5Tm90ZXMsIGdldERhaWx5Tm90ZSB9IGZyb20gXCIuL2RhaWx5LW5vdGVzXCI7XG5pbXBvcnQgeyBEYXlPZldlZWsgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgWkhfT1JESU5BTFMgfSBmcm9tIFwiLi9sb2NhbGVcIjtcblxuY29uc3QgZGF5c09mV2VlazogRXhjbHVkZTxEYXlPZldlZWssIFwibG9jYWxlLWRlZmF1bHRcIj5bXSA9IFtcbiAgXCJzdW5kYXlcIixcbiAgXCJtb25kYXlcIixcbiAgXCJ0dWVzZGF5XCIsXG4gIFwid2VkbmVzZGF5XCIsXG4gIFwidGh1cnNkYXlcIixcbiAgXCJmcmlkYXlcIixcbiAgXCJzYXR1cmRheVwiLFxuXTtcblxuZGVjbGFyZSBtb2R1bGUgXCJvYnNpZGlhblwiIHtcbiAgaW50ZXJmYWNlIEVkaXRvciB7XG4gICAgY206IHtcbiAgICAgIHN0YXRlOiB7XG4gICAgICAgIHdvcmRBdChwb3M6IG51bWJlcik6IHsgZnJvbTogbnVtYmVyOyB0bzogbnVtYmVyIH0gfCBudWxsO1xuICAgICAgfTtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldFdvcmRCb3VuZGFyaWVzKGVkaXRvcjogRWRpdG9yKTogRWRpdG9yUmFuZ2Uge1xuICBjb25zdCBjdXJzb3IgPSBlZGl0b3IuZ2V0Q3Vyc29yKCk7XG4gIGNvbnN0IHBvcyA9IGVkaXRvci5wb3NUb09mZnNldChjdXJzb3IpO1xuICBjb25zdCB3b3JkID0gZWRpdG9yLmNtLnN0YXRlLndvcmRBdChwb3MpO1xuICBpZiAoIXdvcmQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZnJvbTogZWRpdG9yLm9mZnNldFRvUG9zKHBvcyksXG4gICAgICB0bzogZWRpdG9yLm9mZnNldFRvUG9zKHBvcyksXG4gICAgfTtcbiAgfVxuICBjb25zdCB3b3JkU3RhcnQgPSBlZGl0b3Iub2Zmc2V0VG9Qb3Mod29yZC5mcm9tKTtcbiAgY29uc3Qgd29yZEVuZCA9IGVkaXRvci5vZmZzZXRUb1Bvcyh3b3JkLnRvKTtcbiAgcmV0dXJuIHtcbiAgICBmcm9tOiB3b3JkU3RhcnQsXG4gICAgdG86IHdvcmRFbmQsXG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZWxlY3RlZFRleHQoZWRpdG9yOiBFZGl0b3IpOiBzdHJpbmcge1xuICBpZiAoZWRpdG9yLnNvbWV0aGluZ1NlbGVjdGVkKCkpIHtcbiAgICByZXR1cm4gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHdvcmRCb3VuZGFyaWVzID0gZ2V0V29yZEJvdW5kYXJpZXMoZWRpdG9yKTtcbiAgICBlZGl0b3Iuc2V0U2VsZWN0aW9uKHdvcmRCb3VuZGFyaWVzLmZyb20sIHdvcmRCb3VuZGFyaWVzLnRvKTtcbiAgICByZXR1cm4gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGp1c3RDdXJzb3IoXG4gIGVkaXRvcjogRWRpdG9yLFxuICBjdXJzb3I6IEVkaXRvclBvc2l0aW9uLFxuICBuZXdTdHI6IHN0cmluZyxcbiAgb2xkU3RyOiBzdHJpbmdcbik6IHZvaWQge1xuICBjb25zdCBjdXJzb3JPZmZzZXQgPSBuZXdTdHIubGVuZ3RoIC0gb2xkU3RyLmxlbmd0aDtcbiAgZWRpdG9yLnNldEN1cnNvcih7XG4gICAgbGluZTogY3Vyc29yLmxpbmUsXG4gICAgY2g6IGN1cnNvci5jaCArIGN1cnNvck9mZnNldCxcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGb3JtYXR0ZWREYXRlKGRhdGU6IERhdGUsIGZvcm1hdDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHdpbmRvdy5tb21lbnQoZGF0ZSkuZm9ybWF0KGZvcm1hdCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYXN0RGF5T2ZNb250aCh5ZWFyOiBudW1iZXIsIG1vbnRoOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gbmV3IERhdGUoeWVhciwgbW9udGgsIDApLmdldERhdGUoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVHJ1dGh5KGZsYWc6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gW1wieVwiLCBcInllc1wiLCBcIjFcIiwgXCJ0XCIsIFwidHJ1ZVwiXS5pbmRleE9mKGZsYWcudG9Mb3dlckNhc2UoKSkgPj0gMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldExvY2FsZVdlZWtTdGFydCgpOiBFeGNsdWRlPERheU9mV2VlaywgXCJsb2NhbGUtZGVmYXVsdFwiPiB7XG4gIGNvbnN0IGxvY2FsZURhdGEgPSB3aW5kb3cubW9tZW50LmxvY2FsZURhdGEoKSBhcyB1bmtub3duIGFzIHtcbiAgICBfd2VlazogeyBkb3c6IG51bWJlciB9O1xuICB9O1xuICBjb25zdCBzdGFydE9mV2VlazogbnVtYmVyID0gbG9jYWxlRGF0YS5fd2Vlay5kb3c7XG4gIHJldHVybiBkYXlzT2ZXZWVrW3N0YXJ0T2ZXZWVrXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlTWFya2Rvd25MaW5rKFxuICBhcHA6IEFwcCxcbiAgc3VicGF0aDogc3RyaW5nLFxuICBhbGlhcz86IHN0cmluZ1xuKTogc3RyaW5nIHtcbiAgY29uc3QgdXNlTWFya2Rvd25MaW5rcyA9IChcbiAgICBhcHAudmF1bHQgYXMgdW5rbm93biBhcyB7IGdldENvbmZpZyhrZXk6IHN0cmluZyk6IGJvb2xlYW4gfVxuICApLmdldENvbmZpZyhcInVzZU1hcmtkb3duTGlua3NcIik7XG4gIGNvbnN0IHBhdGggPSBub3JtYWxpemVQYXRoKHN1YnBhdGgpO1xuXG4gIGlmICh1c2VNYXJrZG93bkxpbmtzKSB7XG4gICAgaWYgKGFsaWFzKSB7XG4gICAgICByZXR1cm4gYFske2FsaWFzfV0oJHtwYXRoLnJlcGxhY2UoLyAvZywgXCIlMjBcIil9KWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBgWyR7c3VicGF0aH1dKCR7cGF0aH0pYDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGFsaWFzKSB7XG4gICAgICByZXR1cm4gYFtbJHtwYXRofXwke2FsaWFzfV1dYDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGBbWyR7cGF0aH1dXWA7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREYXRlTGlua0FsaWFzKFxuICBwbHVnaW46IHtcbiAgICBzZXR0aW5nczogeyBkZWZhdWx0QWxpYXM6IHN0cmluZyB9O1xuICAgIHBhcnNlRGF0ZTogKHM6IHN0cmluZykgPT4geyBtb21lbnQ6IG1vbWVudC5Nb21lbnQgfTtcbiAgfSxcbiAgZGF0ZUlucHV0OiBzdHJpbmcsXG4gIHVzZVN1Z2dlc3Rpb25MYWJlbDogYm9vbGVhblxuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKHVzZVN1Z2dlc3Rpb25MYWJlbCkge1xuICAgIHJldHVybiBkYXRlSW5wdXQ7XG4gIH1cbiAgaWYgKHBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0QWxpYXMpIHtcbiAgICBjb25zdCBwYXJzZWQgPSBwbHVnaW4ucGFyc2VEYXRlKGRhdGVJbnB1dCk7XG4gICAgcmV0dXJuIHBhcnNlZC5tb21lbnQuaXNWYWxpZCgpXG4gICAgICA/IHBhcnNlZC5tb21lbnQuZm9ybWF0KHBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0QWxpYXMpXG4gICAgICA6IHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3JDcmVhdGVEYWlseU5vdGUoXG4gIGRhdGU6IG1vbWVudC5Nb21lbnRcbik6IFByb21pc2U8VEZpbGUgfCBudWxsPiB7XG4gIGNvbnN0IGRlc2lyZWROb3RlID0gZ2V0RGFpbHlOb3RlKGRhdGUsIGdldEFsbERhaWx5Tm90ZXMoKSk7XG4gIGlmIChkZXNpcmVkTm90ZSkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoZGVzaXJlZE5vdGUpO1xuICB9XG4gIHJldHVybiBjcmVhdGVEYWlseU5vdGUoZGF0ZSk7XG59XG5cbi8vIC0tLS0g5Lit5paH5bqP5pWw6K+N6Kej5p6QIC0tLS1cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVpoT3JkaW5hbCh0ZXh0OiBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3QgbWF0Y2ggPSB0ZXh0Lm1hdGNoKC/nrKwoW+S4gOS6jOS4ieWbm+S6lOWFreS4g+WFq+S5neWNgeW7v+WNhV0rKS8pO1xuICBpZiAobWF0Y2ggJiYgWkhfT1JESU5BTFNbbWF0Y2hbMV1dICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gWkhfT1JESU5BTFNbbWF0Y2hbMV1dO1xuICB9XG4gIHJldHVybiBudWxsO1xufVxuIiwiaW1wb3J0ICogYXMgY2hyb25vIGZyb20gXCJjaHJvbm8tbm9kZVwiO1xuaW1wb3J0IHsgQ2hyb25vLCBQYXJzZXIsIFBhcnNpbmdDb250ZXh0IH0gZnJvbSBcImNocm9uby1ub2RlXCI7XG5pbXBvcnQgeyBtb21lbnQgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuaW1wb3J0IHsgRGF5T2ZXZWVrIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcbmltcG9ydCB7XG4gIFpIX1JFTEFUSVZFX0RBWVMsXG4gIFpIX1NQRUNJQUxfREFURVMsXG4gIFpIX09SRElOQUxTLFxuICBaSF9USElTLFxuICBaSF9ORVhULFxuICBaSF9XRUVLX1dPUkRTLFxuICBaSF9NT05USF9XT1JEUyxcbiAgWkhfWUVBUl9XT1JEUyxcbiAgWkhfUE9TSVRJT04sXG59IGZyb20gXCIuL2xvY2FsZVwiO1xuaW1wb3J0IHsgZ2V0TGFzdERheU9mTW9udGgsIGdldExvY2FsZVdlZWtTdGFydCB9IGZyb20gXCIuL3V0aWxzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTkxEUmVzdWx0IHtcbiAgZm9ybWF0dGVkU3RyaW5nOiBzdHJpbmc7XG4gIGRhdGU6IERhdGU7XG4gIG1vbWVudDogbW9tZW50Lk1vbWVudDtcbn1cblxuLy8g57mB5L2T4oaS566A5L2T5pel5pyf5a2X56ym5pig5bCE77yM56Gu5L+dIGNocm9ubyB6aC5oYW5zIOiDveato+ehruino+aekOe5geS9k+i+k+WFpVxuY29uc3QgVFJBRF9UT19TSU1QOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBcIumAsVwiOiBcIuWRqFwiLFxuICBcIuemrlwiOiBcIuekvFwiLFxuICBcIuWAi1wiOiBcIuS4qlwiLFxuICBcIumAmVwiOiBcIui/mVwiLFxuICBcIuS+hlwiOiBcIuadpVwiLFxuICBcIuevgFwiOiBcIuiKglwiLFxuICBcIuWLnlwiOiBcIuWKs1wiLFxuICBcIuWLlVwiOiBcIuWKqFwiLFxuICBcIuWci1wiOiBcIuWbvVwiLFxuICBcIuaFtlwiOiBcIuW6hlwiLFxuICBcIuiBllwiOiBcIuWco1wiLFxuICBcIuiqlVwiOiBcIuivnlwiLFxuICBcIuiQrFwiOiBcIuS4h1wiLFxuICBcIuW+jFwiOiBcIuWQjlwiLFxuICBcIumZvVwiOiBcIumYs1wiLFxuICBcIue1glwiOiBcIue7iFwiLFxufTtcblxuZnVuY3Rpb24gbm9ybWFsaXplVHJhZGl0aW9uYWwodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHJlc3VsdCA9IHRleHQ7XG4gIGZvciAoY29uc3QgW3RyYWQsIHNpbXBdIG9mIE9iamVjdC5lbnRyaWVzKFRSQURfVE9fU0lNUCkpIHtcbiAgICByZXN1bHQgPSByZXN1bHQucmVwbGFjZShuZXcgUmVnRXhwKHRyYWQsIFwiZ1wiKSwgc2ltcCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlWmhDaHJvbm8oKTogQ2hyb25vIHtcbiAgY29uc3QgemhDb25maWcgPSBjaHJvbm8uemguaGFucy5jcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uKCk7XG4gIGNvbnN0IHpoQ2hyb25vID0gbmV3IENocm9ubyh6aENvbmZpZyk7XG5cbiAgLy8gQ3VzdG9tIFBhcnNlciAxOiDnibnmrorlhazljobml6XmnJ/vvIjlhYPml6bjgIHlm73luobjgIHlnKPor57nrYnvvIlcbiAgY29uc3Qgc3BlY2lhbEtleXMgPSBPYmplY3Qua2V5cyhaSF9TUEVDSUFMX0RBVEVTKS5zb3J0KFxuICAgIChhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4gYi5sZW5ndGggLSBhLmxlbmd0aFxuICApO1xuICBpZiAoc3BlY2lhbEtleXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHNwZWNpYWxQYXR0ZXJuID0gc3BlY2lhbEtleXMuam9pbihcInxcIik7XG4gICAgemhDaHJvbm8ucGFyc2Vycy5wdXNoKHtcbiAgICAgIHBhdHRlcm46ICgpID0+IG5ldyBSZWdFeHAoc3BlY2lhbFBhdHRlcm4pLFxuICAgICAgZXh0cmFjdDogKF9jb250ZXh0OiBQYXJzaW5nQ29udGV4dCwgbWF0Y2g6IFJlZ0V4cE1hdGNoQXJyYXkpID0+IHtcbiAgICAgICAgY29uc3QgZGF0ZSA9IFpIX1NQRUNJQUxfREFURVNbbWF0Y2hbMF0gYXMgc3RyaW5nXTtcbiAgICAgICAgaWYgKGRhdGUpIHtcbiAgICAgICAgICByZXR1cm4geyBkYXk6IGRhdGUuZGF5LCBtb250aDogZGF0ZS5tb250aCB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICB9IGFzIFBhcnNlcik7XG4gIH1cblxuICAvLyBDdXN0b20gUGFyc2VyIDI6IOS4reaWh+W6j+aVsOivjeOAjOesrOS4gOOAjeOAjOesrOS6jOOAjS4uLiDjgIznrKzkuInljYHkuIDjgI1cbiAgY29uc3Qgb3JkaW5hbEtleXMgPSBPYmplY3Qua2V5cyhaSF9PUkRJTkFMUykuc29ydChcbiAgICAoYTogc3RyaW5nLCBiOiBzdHJpbmcpID0+IGIubGVuZ3RoIC0gYS5sZW5ndGhcbiAgKTtcbiAgY29uc3Qgb3JkaW5hbFBhdHRlcm4gPSBvcmRpbmFsS2V5cy5qb2luKFwifFwiKTtcbiAgemhDaHJvbm8ucGFyc2Vycy5wdXNoKHtcbiAgICBwYXR0ZXJuOiAoKSA9PiBuZXcgUmVnRXhwKGDnrKwoJHtvcmRpbmFsUGF0dGVybn0pYCksXG4gICAgZXh0cmFjdDogKF9jb250ZXh0OiBQYXJzaW5nQ29udGV4dCwgbWF0Y2g6IFJlZ0V4cE1hdGNoQXJyYXkpID0+IHtcbiAgICAgIGNvbnN0IG51bSA9IFpIX09SRElOQUxTW21hdGNoWzFdIGFzIHN0cmluZ107XG4gICAgICBpZiAobnVtICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIHsgZGF5OiBudW0sIG1vbnRoOiBtb21lbnQoKS5tb250aCgpICsgMSB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgfSBhcyBQYXJzZXIpO1xuXG4gIC8vIEN1c3RvbSBQYXJzZXIgMzog55u45a+55pel77yI5ZCO5aSp44CB5aSn5ZCO5aSp44CB5YmN5aSp44CB5aSn5YmN5aSp77yJXG4gIC8vIGNocm9ubyB6aC5oYW5zIOWPquimhuebluS7iuWkqS/mmI7lpKkv5pio5aSpXG4gIGNvbnN0IHJlbGF0aXZlRW50cmllczogW3N0cmluZywgbnVtYmVyXVtdID0gT2JqZWN0LmVudHJpZXMoWkhfUkVMQVRJVkVfREFZUylcbiAgICAuZmlsdGVyKFxuICAgICAgKFssIG9mZnNldF06IFtzdHJpbmcsIG51bWJlcl0pID0+XG4gICAgICAgIG9mZnNldCAhPT0gMCAmJiBvZmZzZXQgIT09IDEgJiYgb2Zmc2V0ICE9PSAtMVxuICAgIClcbiAgICAuc29ydChcbiAgICAgIChhOiBbc3RyaW5nLCBudW1iZXJdLCBiOiBbc3RyaW5nLCBudW1iZXJdKSA9PiBiWzBdLmxlbmd0aCAtIGFbMF0ubGVuZ3RoXG4gICAgKTtcblxuICBpZiAocmVsYXRpdmVFbnRyaWVzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCByZWxQYXR0ZXJuID0gcmVsYXRpdmVFbnRyaWVzLm1hcCgoW2tdOiBbc3RyaW5nLCBudW1iZXJdKSA9PiBrKS5qb2luKFwifFwiKTtcbiAgICB6aENocm9uby5wYXJzZXJzLnB1c2goe1xuICAgICAgcGF0dGVybjogKCkgPT4gbmV3IFJlZ0V4cChyZWxQYXR0ZXJuKSxcbiAgICAgIGV4dHJhY3Q6IChjb250ZXh0OiBhbnksIG1hdGNoOiBhbnkpID0+IHtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gWkhfUkVMQVRJVkVfREFZU1ttYXRjaFswXSBhcyBzdHJpbmddO1xuICAgICAgICBpZiAob2Zmc2V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zdCByZWZEYXRlID0gY29udGV4dC5yZWZEYXRlIHx8IG5ldyBEYXRlKCk7XG4gICAgICAgICAgY29uc3QgdGFyZ2V0ID0gbmV3IERhdGUocmVmRGF0ZSk7XG4gICAgICAgICAgdGFyZ2V0LnNldERhdGUodGFyZ2V0LmdldERhdGUoKSArIG9mZnNldCk7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGRheTogdGFyZ2V0LmdldERhdGUoKSxcbiAgICAgICAgICAgIG1vbnRoOiB0YXJnZXQuZ2V0TW9udGgoKSArIDEsXG4gICAgICAgICAgICB5ZWFyOiB0YXJnZXQuZ2V0RnVsbFllYXIoKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSxcbiAgICB9IGFzIFBhcnNlcik7XG4gIH1cblxuICByZXR1cm4gemhDaHJvbm87XG59XG5cbi8vIOaehOW7uueUqOS6juato+WImeeahOaooeW8j+eJh+autVxuZnVuY3Rpb24gYnVpbGRQYXR0ZXJuKHdvcmRzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiB3b3Jkcy5zb3J0KChhOiBzdHJpbmcsIGI6IHN0cmluZykgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCkuam9pbihcInxcIik7XG59XG5cbmNvbnN0IFRISVNfUEFUVEVSTiA9IGJ1aWxkUGF0dGVybihaSF9USElTKTtcbmNvbnN0IE5FWFRfUEFUVEVSTiA9IGJ1aWxkUGF0dGVybihaSF9ORVhUKTtcbmNvbnN0IFdFRUtfUEFUVEVSTiA9IGJ1aWxkUGF0dGVybihaSF9XRUVLX1dPUkRTKTtcbmNvbnN0IE1PTlRIX1BBVFRFUk4gPSBidWlsZFBhdHRlcm4oWkhfTU9OVEhfV09SRFMpO1xuY29uc3QgWUVBUl9QQVRURVJOID0gYnVpbGRQYXR0ZXJuKFpIX1lFQVJfV09SRFMpO1xuY29uc3QgRU5EX09GX01PTlRIX1BBVFRFUk4gPSBidWlsZFBhdHRlcm4oWkhfUE9TSVRJT04uZW5kT2ZNb250aCk7XG5jb25zdCBNSURfT0ZfTU9OVEhfUEFUVEVSTiA9IGJ1aWxkUGF0dGVybihaSF9QT1NJVElPTi5taWRPZk1vbnRoKTtcblxuLy8g5a6J5YWo6Kej5p6Q5pel5pyf77yM5aSx6LSl5pe26L+U5Zue5b2T5YmN5pel5pyfXG5mdW5jdGlvbiBzYWZlUGFyc2VEYXRlKHBhcnNlcjogQ2hyb25vLCB0ZXh0OiBzdHJpbmcsIHJlZkRhdGU/OiBEYXRlLCBvcHRpb24/OiBjaHJvbm8uUGFyc2luZ09wdGlvbik6IERhdGUge1xuICBjb25zdCByZXN1bHQgPSBwYXJzZXIucGFyc2VEYXRlKHRleHQsIHJlZkRhdGUsIG9wdGlvbik7XG4gIHJldHVybiByZXN1bHQgPz8gbmV3IERhdGUoKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTkxEUGFyc2VyIHtcbiAgY2hyb25vOiBDaHJvbm87XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jaHJvbm8gPSBjcmVhdGVaaENocm9ubygpO1xuICB9XG5cbiAgZ2V0UGFyc2VkRGF0ZShzZWxlY3RlZFRleHQ6IHN0cmluZywgd2Vla1N0YXJ0UHJlZmVyZW5jZTogRGF5T2ZXZWVrKTogRGF0ZSB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFRleHQgPSBub3JtYWxpemVUcmFkaXRpb25hbChzZWxlY3RlZFRleHQpO1xuICAgIGNvbnN0IHBhcnNlciA9IHRoaXMuY2hyb25vO1xuICAgIGNvbnN0IGluaXRpYWxQYXJzZSA9IHBhcnNlci5wYXJzZShub3JtYWxpemVkVGV4dCk7XG4gICAgY29uc3Qgd2Vla2RheUlzQ2VydGFpbiA9IGluaXRpYWxQYXJzZVswXT8uc3RhcnQuaXNDZXJ0YWluKFwid2Vla2RheVwiKTtcblxuICAgIGNvbnN0IHdlZWtTdGFydCA9XG4gICAgICB3ZWVrU3RhcnRQcmVmZXJlbmNlID09PSBcImxvY2FsZS1kZWZhdWx0XCJcbiAgICAgICAgPyBnZXRMb2NhbGVXZWVrU3RhcnQoKVxuICAgICAgICA6IHdlZWtTdGFydFByZWZlcmVuY2U7XG5cbiAgICAvLyAtLS0tIOeJueauiuaooeW8j+WkhOeQhiAtLS0tXG5cbiAgICAvLyDjgIzov5nlkaggLyDmnKzlkaggLyDov5nkuKrmmJ/mnJ/jgI3ihpIg5pys5ZGo56ys5LiA5aSpXG4gICAgY29uc3QgdGhpc1dlZWtSZSA9IG5ldyBSZWdFeHAoXG4gICAgICBgXig/OiR7VEhJU19QQVRURVJOfSlcXFxccyooPzoke1dFRUtfUEFUVEVSTn0pJGBcbiAgICApO1xuICAgIGlmICh0aGlzV2Vla1JlLnRlc3Qobm9ybWFsaXplZFRleHQudHJpbSgpKSkge1xuICAgICAgcmV0dXJuIHNhZmVQYXJzZURhdGUocGFyc2VyLCBg5pys5ZGoJHt3ZWVrU3RhcnR9YCwgbmV3IERhdGUoKSk7XG4gICAgfVxuXG4gICAgLy8g44CM5LiL5ZGoIC8g5LiL5Liq5pif5pyf44CN4oaSIOS4i+WRqOesrOS4gOWkqVxuICAgIGNvbnN0IG5leHRXZWVrUmUgPSBuZXcgUmVnRXhwKFxuICAgICAgYF4oPzoke05FWFRfUEFUVEVSTn0pXFxcXHMqKD86JHtXRUVLX1BBVFRFUk59KSRgXG4gICAgKTtcbiAgICBpZiAobmV4dFdlZWtSZS50ZXN0KG5vcm1hbGl6ZWRUZXh0LnRyaW0oKSkpIHtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgYOS4i+WRqCR7d2Vla1N0YXJ0fWAsIG5ldyBEYXRlKCksIHtcbiAgICAgICAgZm9yd2FyZERhdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDjgIzkuIvkuKrmnIggLyDkuIvmnIjjgI1cbiAgICBjb25zdCBuZXh0TW9udGhSZSA9IG5ldyBSZWdFeHAoXG4gICAgICBgXig/OiR7TkVYVF9QQVRURVJOfSlcXFxccyooPzoke01PTlRIX1BBVFRFUk59KSRgXG4gICAgKTtcbiAgICBpZiAobmV4dE1vbnRoUmUudGVzdChub3JtYWxpemVkVGV4dC50cmltKCkpKSB7XG4gICAgICBjb25zdCB0aGlzTW9udGggPSBzYWZlUGFyc2VEYXRlKHBhcnNlciwgXCLmnKzmnIhcIiwgbmV3IERhdGUoKSwge1xuICAgICAgICBmb3J3YXJkRGF0ZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHNhZmVQYXJzZURhdGUocGFyc2VyLCBub3JtYWxpemVkVGV4dCwgdGhpc01vbnRoLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g44CM5piO5bm0IC8g5p2l5bm044CNXG4gICAgY29uc3QgbmV4dFllYXJSZSA9IG5ldyBSZWdFeHAoXG4gICAgICBgXig/OiR7TkVYVF9QQVRURVJOfXzmmI4pXFxcXHMqKD86JHtZRUFSX1BBVFRFUk59KSRgXG4gICAgKTtcbiAgICBpZiAobmV4dFllYXJSZS50ZXN0KG5vcm1hbGl6ZWRUZXh0LnRyaW0oKSkpIHtcbiAgICAgIGNvbnN0IHRoaXNZZWFyID0gc2FmZVBhcnNlRGF0ZShwYXJzZXIsIFwi5LuK5bm0XCIsIG5ldyBEYXRlKCksIHtcbiAgICAgICAgZm9yd2FyZERhdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgbm9ybWFsaXplZFRleHQsIHRoaXNZZWFyLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g44CM5pyI5bqVIC8g5pyI5pyr44CN4oaSIOW9k+aciOacgOWQjuS4gOWkqVxuICAgIGNvbnN0IGVuZE9mTW9udGhSZSA9IG5ldyBSZWdFeHAoXG4gICAgICBgKCR7RU5EX09GX01PTlRIX1BBVFRFUk59KVxcXFxzKihbXlxcXFxuXFxcXHJdKilgXG4gICAgKTtcbiAgICBjb25zdCBlbmRPZk1vbnRoTWF0Y2ggPSBub3JtYWxpemVkVGV4dC5tYXRjaChlbmRPZk1vbnRoUmUpO1xuICAgIGlmIChlbmRPZk1vbnRoTWF0Y2gpIHtcbiAgICAgIGNvbnN0IGNvbnRleHRTdHIgPSBlbmRPZk1vbnRoTWF0Y2hbMl0udHJpbSgpIHx8IFwi5pys5pyIXCI7XG4gICAgICBjb25zdCB0ZW1wRGF0ZSA9IHBhcnNlci5wYXJzZShjb250ZXh0U3RyKTtcbiAgICAgIGNvbnN0IHllYXIgPVxuICAgICAgICB0ZW1wRGF0ZVswXT8uc3RhcnQuZ2V0KFwieWVhclwiKSA/PyBtb21lbnQoKS55ZWFyKCk7XG4gICAgICBjb25zdCBtb250aCA9XG4gICAgICAgIHRlbXBEYXRlWzBdPy5zdGFydC5nZXQoXCJtb250aFwiKSA/PyBtb21lbnQoKS5tb250aCgpICsgMTtcbiAgICAgIGNvbnN0IGxhc3REYXkgPSBnZXRMYXN0RGF5T2ZNb250aCh5ZWFyLCBtb250aCk7XG4gICAgICByZXR1cm4gc2FmZVBhcnNlRGF0ZShcbiAgICAgICAgcGFyc2VyLFxuICAgICAgICBgJHt5ZWFyfS0ke21vbnRofS0ke2xhc3REYXl9YCxcbiAgICAgICAgbmV3IERhdGUoKSxcbiAgICAgICAgeyBmb3J3YXJkRGF0ZTogdHJ1ZSB9XG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIOOAjOaciOS4reOAjeKGkiDlvZPmnIggMTUg5pelXG4gICAgY29uc3QgbWlkT2ZNb250aFJlID0gbmV3IFJlZ0V4cChcbiAgICAgIGAoJHtNSURfT0ZfTU9OVEhfUEFUVEVSTn0pXFxcXHMqKFteXFxcXG5cXFxccl0qKWBcbiAgICApO1xuICAgIGNvbnN0IG1pZE9mTW9udGhNYXRjaCA9IG5vcm1hbGl6ZWRUZXh0Lm1hdGNoKG1pZE9mTW9udGhSZSk7XG4gICAgaWYgKG1pZE9mTW9udGhNYXRjaCkge1xuICAgICAgY29uc3QgY29udGV4dFN0ciA9IG1pZE9mTW9udGhNYXRjaFsyXS50cmltKCkgfHwgXCLmnKzmnIhcIjtcbiAgICAgIHJldHVybiBzYWZlUGFyc2VEYXRlKHBhcnNlciwgYCR7Y29udGV4dFN0cn0gMTXml6VgLCBuZXcgRGF0ZSgpLCB7XG4gICAgICAgIGZvcndhcmREYXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8g5Y+q5a+56KO45pif5pyf5Yeg77yI5aaC44CM5ZGo5LqU44CN6ICM6Z2e44CM5LiL5ZGo5LqU44CN77yJ5L2/55SoIG1vbWVudCDorqHnrpfvvIxcbiAgICAvLyDpgb/lhY0gY2hyb25v44CM5pyA6L+R5Yy56YWN44CN562W55Wl5Y+X5Y+C6ICD5pel5pyf5YGP56e75b2x5ZON6ICM6Lez5Yiw5LiK5ZGo44CCXG4gICAgLy8g44CM5LiL5ZGo5LqU44CN562J5bim5L+u6aWw6K+N55qE55SxIGNocm9ubyDmraPluLjop6PmnpDvvIhpc0NlcnRhaW4oXCJkYXlcIik9dHJ1Ze+8ieOAglxuICAgIGlmICh3ZWVrZGF5SXNDZXJ0YWluICYmICFpbml0aWFsUGFyc2VbMF0/LnN0YXJ0LmlzQ2VydGFpbihcImRheVwiKSkge1xuICAgICAgY29uc3Qgd2Vla2RheU51bSA9IGluaXRpYWxQYXJzZVswXT8uc3RhcnQuZ2V0KFwid2Vla2RheVwiKTtcbiAgICAgIGlmICh0eXBlb2Ygd2Vla2RheU51bSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICAvLyDlsIblkajlh6DnmoTlkI3np7DovazkuLrmlbDlrZcgKFN1bmRheT0wKVxuICAgICAgICBjb25zdCB0b0RheU51bSA9IChkOiBzdHJpbmcpOiBudW1iZXIgPT4ge1xuICAgICAgICAgIHN3aXRjaCAoZCkge1xuICAgICAgICAgICAgY2FzZSBcInN1bmRheVwiOiByZXR1cm4gMDtcbiAgICAgICAgICAgIGNhc2UgXCJtb25kYXlcIjogcmV0dXJuIDE7XG4gICAgICAgICAgICBjYXNlIFwidHVlc2RheVwiOiByZXR1cm4gMjtcbiAgICAgICAgICAgIGNhc2UgXCJ3ZWRuZXNkYXlcIjogcmV0dXJuIDM7XG4gICAgICAgICAgICBjYXNlIFwidGh1cnNkYXlcIjogcmV0dXJuIDQ7XG4gICAgICAgICAgICBjYXNlIFwiZnJpZGF5XCI6IHJldHVybiA1O1xuICAgICAgICAgICAgY2FzZSBcInNhdHVyZGF5XCI6IHJldHVybiA2O1xuICAgICAgICAgICAgZGVmYXVsdDogcmV0dXJuIDE7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBzdGFydERheSA9IHdlZWtTdGFydFByZWZlcmVuY2UgPT09IFwibG9jYWxlLWRlZmF1bHRcIlxuICAgICAgICAgID8gdG9EYXlOdW0oZ2V0TG9jYWxlV2Vla1N0YXJ0KCkpXG4gICAgICAgICAgOiB0b0RheU51bSh3ZWVrU3RhcnRQcmVmZXJlbmNlKTtcblxuICAgICAgICBjb25zdCB0b2RheSA9IG1vbWVudCgpO1xuICAgICAgICBjb25zdCB3ZWVrU3RhcnQgPSB0b2RheS5jbG9uZSgpLmRheShzdGFydERheSk7XG4gICAgICAgIGlmICh3ZWVrU3RhcnQuaXNBZnRlcih0b2RheSwgXCJkYXlcIikpIHtcbiAgICAgICAgICB3ZWVrU3RhcnQuc3VidHJhY3QoNywgXCJkYXlzXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gKHdlZWtkYXlOdW0gLSBzdGFydERheSArIDcpICUgNztcbiAgICAgICAgcmV0dXJuIHdlZWtTdGFydC5hZGQob2Zmc2V0LCBcImRheXNcIikudG9EYXRlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNhZmVQYXJzZURhdGUocGFyc2VyLCBub3JtYWxpemVkVGV4dCwgbmV3IERhdGUoKSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEFwcCwgUGx1Z2luU2V0dGluZ1RhYiwgU2V0dGluZyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgTmF0dXJhbExhbmd1YWdlRGF0ZXMgZnJvbSBcIi4vbWFpblwiO1xuaW1wb3J0IHsgZ2V0TG9jYWxlV2Vla1N0YXJ0IH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuZXhwb3J0IHR5cGUgRGF5T2ZXZWVrID1cbiAgfCBcInN1bmRheVwiXG4gIHwgXCJtb25kYXlcIlxuICB8IFwidHVlc2RheVwiXG4gIHwgXCJ3ZWRuZXNkYXlcIlxuICB8IFwidGh1cnNkYXlcIlxuICB8IFwiZnJpZGF5XCJcbiAgfCBcInNhdHVyZGF5XCJcbiAgfCBcImxvY2FsZS1kZWZhdWx0XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTkxEU2V0dGluZ3Mge1xuICBhdXRvc3VnZ2VzdFRvZ2dsZUxpbms6IGJvb2xlYW47XG4gIGF1dG9jb21wbGV0ZVRyaWdnZXJQaHJhc2U6IHN0cmluZztcbiAgaXNBdXRvc3VnZ2VzdEVuYWJsZWQ6IGJvb2xlYW47XG5cbiAgZm9ybWF0OiBzdHJpbmc7XG4gIGRlZmF1bHRBbGlhczogc3RyaW5nO1xuICB3ZWVrU3RhcnQ6IERheU9mV2VlaztcblxuICBtb2RhbFRvZ2dsZUxpbms6IGJvb2xlYW47XG4gIG1vZGFsTW9tZW50Rm9ybWF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBOTERTZXR0aW5ncyA9IHtcbiAgYXV0b3N1Z2dlc3RUb2dnbGVMaW5rOiB0cnVlLFxuICBhdXRvY29tcGxldGVUcmlnZ2VyUGhyYXNlOiBcIkBcIixcbiAgaXNBdXRvc3VnZ2VzdEVuYWJsZWQ6IHRydWUsXG5cbiAgZm9ybWF0OiBcIllZWVktTU0tRERcIixcbiAgZGVmYXVsdEFsaWFzOiBcIlwiLFxuICB3ZWVrU3RhcnQ6IFwibG9jYWxlLWRlZmF1bHRcIixcblxuICBtb2RhbFRvZ2dsZUxpbms6IGZhbHNlLFxuICBtb2RhbE1vbWVudEZvcm1hdDogXCJZWVlZLU1NLUREXCIsXG59O1xuXG5jb25zdCB3ZWVrZGF5cyA9IFtcbiAgXCJzdW5kYXlcIixcbiAgXCJtb25kYXlcIixcbiAgXCJ0dWVzZGF5XCIsXG4gIFwid2VkbmVzZGF5XCIsXG4gIFwidGh1cnNkYXlcIixcbiAgXCJmcmlkYXlcIixcbiAgXCJzYXR1cmRheVwiLFxuXTtcblxuZXhwb3J0IGNsYXNzIE5MRFNldHRpbmdzVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXM7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXMpIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29uc3QgbG9jYWxpemVkV2Vla2RheXMgPSB3aW5kb3cubW9tZW50LndlZWtkYXlzKCk7XG4gICAgY29uc3QgbG9jYWxlV2Vla1N0YXJ0ID0gZ2V0TG9jYWxlV2Vla1N0YXJ0KCk7XG5cbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCLmoLzlvI9cIikuc2V0SGVhZGluZygpO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIuaXpeacn+agvOW8j1wiKVxuICAgICAgLnNldERlc2MoXCLml6XmnJ/nmoTmmL7npLrmoLzlvI/vvIzkvb/nlKggTW9tZW50LmpzIOagvOW8j+Wtl+espuS4slwiKVxuICAgICAgLmFkZE1vbWVudEZvcm1hdCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXREZWZhdWx0Rm9ybWF0KFwiWVlZWS1NTS1ERFwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5mb3JtYXQpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuZm9ybWF0ID0gdmFsdWUgfHwgXCJZWVlZLU1NLUREXCI7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLkuIDlkajku47lkajlh6DlvIDlp4tcIilcbiAgICAgIC5zZXREZXNjKFwi6YCJ5oup5LiA5ZGo55qE6LW35aeL5pelXCIpXG4gICAgICAuYWRkRHJvcGRvd24oKGRyb3Bkb3duKSA9PiB7XG4gICAgICAgIGRyb3Bkb3duLmFkZE9wdGlvbihcbiAgICAgICAgICBcImxvY2FsZS1kZWZhdWx0XCIsXG4gICAgICAgICAgYOezu+e7n+m7mOiupO+8iCR7U3RyaW5nKGxvY2FsZVdlZWtTdGFydCl977yJYFxuICAgICAgICApO1xuICAgICAgICBsb2NhbGl6ZWRXZWVrZGF5cy5mb3JFYWNoKChkYXksIGkpID0+IHtcbiAgICAgICAgICBkcm9wZG93bi5hZGRPcHRpb24od2Vla2RheXNbaV0sIGRheSk7XG4gICAgICAgIH0pO1xuICAgICAgICBkcm9wZG93bi5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy53ZWVrU3RhcnQudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgIGRyb3Bkb3duLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZTogRGF5T2ZXZWVrKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Mud2Vla1N0YXJ0ID0gdmFsdWU7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIuiHquWKqOW7uuiurlwiKS5zZXRIZWFkaW5nKCk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwi5ZCv55So5pel5pyf6Ieq5Yqo5bu66K6uXCIpXG4gICAgICAuc2V0RGVzYyhcbiAgICAgICAgYOW8gOWQr+WQju+8jOi+k+WFpSAke3RoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9jb21wbGV0ZVRyaWdnZXJQaHJhc2V9IOS8muinpuWPkeaXpeacn+W7uuiuruiPnOWNlWBcbiAgICAgIClcbiAgICAgIC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cbiAgICAgICAgdG9nZ2xlXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmlzQXV0b3N1Z2dlc3RFbmFibGVkKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmlzQXV0b3N1Z2dlc3RFbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLop6blj5HlrZfnrKZcIilcbiAgICAgIC5zZXREZXNjKFwi6L6T5YWl5q2k5a2X56ym6Kem5Y+R6Ieq5Yqo5bu66K6uXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT5cbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihcIkBcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b2NvbXBsZXRlVHJpZ2dlclBocmFzZSB8fCBcIkBcIilcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvY29tcGxldGVUcmlnZ2VyUGhyYXNlID0gdmFsdWUudHJpbSgpIHx8IFwiQFwiO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwi5pel5pyf5YyF6KO55Li66ZO+5o6lXCIpXG4gICAgICAuc2V0RGVzYyhcIuW8gOWQr+WQju+8jOiHquWKqOW7uuiurueahOaXpeacn+S8muWMheijueWcqCBbW3dpa2lsaW5rXV0g5LitXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0b2dnbGUpID0+XG4gICAgICAgIHRvZ2dsZVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvc3VnZ2VzdFRvZ2dsZUxpbmspXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b3N1Z2dlc3RUb2dnbGVMaW5rID0gdmFsdWU7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KVxuICAgICAgKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCLpk77mjqXpu5jorqTliKvlkI3moLzlvI9cIilcbiAgICAgIC5zZXREZXNjKFwi5Yib5bu6IHdpa2kg6ZO+5o6l5pe255qE6buY6K6k5Yir5ZCN5qC85byP77yITW9tZW50LmpzIOagvOW8j++8ie+8jOeVmeepuuWImeaXoOWIq+WQjVwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoXCLkvovlpoLvvJpNTeaciERE5pelXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRlZmF1bHRBbGlhcylcbiAgICAgICAgICAub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5kZWZhdWx0QWxpYXMgPSB2YWx1ZSB8fCBcIlwiO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG5cbiAgfVxufVxuIiwiaW1wb3J0IHtcbiAgQXBwLFxuICBFZGl0b3IsXG4gIEVkaXRvclBvc2l0aW9uLFxuICBFZGl0b3JTdWdnZXN0LFxuICBFZGl0b3JTdWdnZXN0Q29udGV4dCxcbiAgRWRpdG9yU3VnZ2VzdFRyaWdnZXJJbmZvLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE5hdHVyYWxMYW5ndWFnZURhdGVzIGZyb20gXCJzcmMvbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVNYXJrZG93bkxpbmssIGdldERhdGVMaW5rQWxpYXMgfSBmcm9tIFwic3JjL3V0aWxzXCI7XG5pbXBvcnQge1xuICBaSF9XRUVLREFZU19TSE9SVCxcbiAgWkhfV0VFS0RBWVNfTE9ORyxcbiAgWkhfV0VFS0RBWVNfQUxULFxufSBmcm9tIFwic3JjL2xvY2FsZVwiO1xuXG5pbnRlcmZhY2UgSURhdGVDb21wbGV0aW9uIHtcbiAgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGF0ZVN1Z2dlc3QgZXh0ZW5kcyBFZGl0b3JTdWdnZXN0PElEYXRlQ29tcGxldGlvbj4ge1xuICBhcHA6IEFwcDtcbiAgcHJpdmF0ZSBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblxuICAgIHRoaXMuc2NvcGUucmVnaXN0ZXIoW1wiU2hpZnRcIl0sIFwiRW50ZXJcIiwgKGV2dDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgKFxuICAgICAgICB0aGlzIGFzIHVua25vd24gYXMge1xuICAgICAgICAgIHN1Z2dlc3Rpb25zOiB7IHVzZVNlbGVjdGVkSXRlbShldnQ6IEtleWJvYXJkRXZlbnQpOiB2b2lkIH07XG4gICAgICAgIH1cbiAgICAgICkuc3VnZ2VzdGlvbnMudXNlU2VsZWN0ZWRJdGVtKGV2dCk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5wbHVnaW4uc2V0dGluZ3MuYXV0b3N1Z2dlc3RUb2dnbGVMaW5rKSB7XG4gICAgICB0aGlzLnNldEluc3RydWN0aW9ucyhbXG4gICAgICAgIHsgY29tbWFuZDogXCJTaGlmdCtFbnRlclwiLCBwdXJwb3NlOiBcIuS9v+eUqOe6r+aXpeacn1wiIH0sXG4gICAgICBdKTtcbiAgICB9XG4gIH1cblxuICBnZXRTdWdnZXN0aW9ucyhjb250ZXh0OiBFZGl0b3JTdWdnZXN0Q29udGV4dCk6IElEYXRlQ29tcGxldGlvbltdIHtcbiAgICBjb25zdCBzdWdnZXN0aW9ucyA9IHRoaXMuZ2V0RGF0ZVN1Z2dlc3Rpb25zKGNvbnRleHQpO1xuICAgIGlmIChzdWdnZXN0aW9ucy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBzdWdnZXN0aW9ucztcbiAgICB9XG4gICAgcmV0dXJuIFt7IGxhYmVsOiBjb250ZXh0LnF1ZXJ5IH1dO1xuICB9XG5cbiAgZ2V0RGF0ZVN1Z2dlc3Rpb25zKFxuICAgIGNvbnRleHQ6IEVkaXRvclN1Z2dlc3RDb250ZXh0IHwgeyBxdWVyeTogc3RyaW5nIH0sXG4gICAgZGVmYXVsdHM6IHN0cmluZ1tdID0gW1wi5LuK5aSpXCIsIFwi5piO5aSpXCIsIFwi5pio5aSpXCIsIFwi5ZCO5aSpXCIsIFwi5b6M5aSpXCJdXG4gICk6IElEYXRlQ29tcGxldGlvbltdIHtcbiAgICBjb25zdCBxdWVyeSA9IGNvbnRleHQucXVlcnkudHJpbSgpO1xuXG4gICAgLy8g5LiK5LiL5paH5Yy56YWN77ya44CM5LiL44CN4oaSIOS4i+WRqOOAgeS4i+S4quaciOOAgeS4i+WRqOS4gH7lkajml6VcbiAgICBpZiAoL17kuIsvLnRlc3QocXVlcnkpKSB7XG4gICAgICBjb25zdCBzdWdnZXN0aW9ucyA9IFtcbiAgICAgICAgXCLkuIvlkahcIiwgXCLkuIvpgLFcIixcbiAgICAgICAgXCLkuIvkuKrmnIhcIiwgXCLkuIvlgIvmnIhcIixcbiAgICAgICAgXCLkuIvlubRcIixcbiAgICAgICAgLi4uWkhfV0VFS0RBWVNfU0hPUlQubWFwKChkKSA9PiBg5LiLJHtkfWApLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19MT05HLm1hcCgoZCkgPT4gYOS4iyR7ZH1gKSxcbiAgICAgICAgLi4uWkhfV0VFS0RBWVNfQUxULm1hcCgoZCkgPT4gYOS4iyR7ZH1gKSxcbiAgICAgIF07XG4gICAgICByZXR1cm4gc3VnZ2VzdGlvbnNcbiAgICAgICAgLm1hcCgobGFiZWwpID0+ICh7IGxhYmVsIH0pKVxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICB9XG5cbiAgICAvLyDjgIzkuIrjgI3ihpIg5LiK5ZGo44CB5LiK5Liq5pyI44CB5LiK5ZGo5LiAfuWRqOaXpVxuICAgIGlmICgvXuS4ii8udGVzdChxdWVyeSkpIHtcbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gW1xuICAgICAgICBcIuS4iuWRqFwiLCBcIuS4iumAsVwiLFxuICAgICAgICBcIuS4iuS4quaciFwiLCBcIuS4iuWAi+aciFwiLFxuICAgICAgICBcIuS4iuW5tFwiLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19TSE9SVC5tYXAoKGQpID0+IGDkuIoke2R9YCksXG4gICAgICAgIC4uLlpIX1dFRUtEQVlTX0xPTkcubWFwKChkKSA9PiBg5LiKJHtkfWApLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19BTFQubWFwKChkKSA9PiBg5LiKJHtkfWApLFxuICAgICAgXTtcbiAgICAgIHJldHVybiBzdWdnZXN0aW9uc1xuICAgICAgICAubWFwKChsYWJlbCkgPT4gKHsgbGFiZWwgfSkpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0ubGFiZWwuc3RhcnRzV2l0aChxdWVyeSkpO1xuICAgIH1cblxuICAgIC8vIOOAjOi/mS/mnKzjgI3ihpIg6L+Z5ZGo44CB6L+Z5Liq5pyIXG4gICAgaWYgKC9eKOi/mXzmnKx86YCZKS8udGVzdChxdWVyeSkpIHtcbiAgICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gW1xuICAgICAgICBcIui/meWRqFwiLCBcIumAmemAsVwiLFxuICAgICAgICBcIui/meS4quaciFwiLCBcIumAmeWAi+aciFwiLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19TSE9SVC5tYXAoKGQpID0+IGDmnKwke2R9YCksXG4gICAgICAgIC4uLlpIX1dFRUtEQVlTX0xPTkcubWFwKChkKSA9PiBg5pysJHtkfWApLFxuICAgICAgICAuLi5aSF9XRUVLREFZU19BTFQubWFwKChkKSA9PiBg5pysJHtkfWApLFxuICAgICAgXTtcbiAgICAgIHJldHVybiBzdWdnZXN0aW9uc1xuICAgICAgICAubWFwKChsYWJlbCkgPT4gKHsgbGFiZWwgfSkpXG4gICAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0ubGFiZWwuc3RhcnRzV2l0aChxdWVyeSkpO1xuICAgIH1cblxuICAgIC8vIOaVsOWtl+W8gOWktO+8mk7lpKnlkI7jgIFO5aSp5YmN44CBTuWRqOWQji4uLlxuICAgIGNvbnN0IG51bU1hdGNoID0gcXVlcnkubWF0Y2goL14oXFxkKykvKTtcbiAgICBpZiAobnVtTWF0Y2gpIHtcbiAgICAgIGNvbnN0IG4gPSBudW1NYXRjaFsxXTtcbiAgICAgIHJldHVybiBbXG4gICAgICAgIGAke2595aSp5ZCOYCxcbiAgICAgICAgYCR7bn3lpKnliY1gLFxuICAgICAgICBgJHtufeWRqOWQjmAsIGAke2596YCx5b6MYCxcbiAgICAgICAgYCR7bn3lkajliY1gLCBgJHtufemAseWJjWAsXG4gICAgICAgIGAke2595Liq5pyI5ZCOYCwgYCR7bn3lgIvmnIjlvoxgLFxuICAgICAgICBgJHtufeS4quaciOWJjWAsIGAke2595YCL5pyI5YmNYCxcbiAgICAgIF1cbiAgICAgICAgLm1hcCgobGFiZWwpID0+ICh7IGxhYmVsIH0pKVxuICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICB9XG5cbiAgICAvLyDkuK3mlofmlbDlrZflvIDlpLTvvJrkuInlpKnlkI7jgIHkupTlpKnlkI4uLi5cbiAgICBjb25zdCB6aE51bU1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgIFwi5LiAXCI6IFwiMVwiLCBcIuS6jFwiOiBcIjJcIiwgXCLkuIlcIjogXCIzXCIsIFwi5ZubXCI6IFwiNFwiLCBcIuS6lFwiOiBcIjVcIixcbiAgICAgIFwi5YWtXCI6IFwiNlwiLCBcIuS4g1wiOiBcIjdcIiwgXCLlhatcIjogXCI4XCIsIFwi5LmdXCI6IFwiOVwiLCBcIuWNgVwiOiBcIjEwXCIsXG4gICAgfTtcbiAgICBjb25zdCB6aE51bU1hdGNoID0gcXVlcnkubWF0Y2goL14oW+S4gOS6jOS4ieWbm+S6lOWFreS4g+WFq+S5neWNgV0pLyk7XG4gICAgaWYgKHpoTnVtTWF0Y2gpIHtcbiAgICAgIGNvbnN0IG4gPSB6aE51bU1hcFt6aE51bU1hdGNoWzFdXTtcbiAgICAgIGlmIChuKSB7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgYCR7emhOdW1NYXRjaFsxXX3lpKnlkI5gLFxuICAgICAgICAgIGAke3poTnVtTWF0Y2hbMV195aSp5YmNYCxcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeWRqOWQjmAsIGAke3poTnVtTWF0Y2hbMV196YCx5b6MYCxcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeWRqOWJjWAsIGAke3poTnVtTWF0Y2hbMV196YCx5YmNYCxcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeS4quaciOWQjmAsIGAke3poTnVtTWF0Y2hbMV195YCL5pyI5b6MYCxcbiAgICAgICAgICBgJHt6aE51bU1hdGNoWzFdfeS4quaciOWJjWAsIGAke3poTnVtTWF0Y2hbMV195YCL5pyI5YmNYCxcbiAgICAgICAgXVxuICAgICAgICAgIC5tYXAoKGxhYmVsKSA9PiAoeyBsYWJlbCB9KSlcbiAgICAgICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtLmxhYmVsLnN0YXJ0c1dpdGgocXVlcnkpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZGVmYXVsdHNcbiAgICAgIC5tYXAoKGxhYmVsKSA9PiAoeyBsYWJlbCB9KSlcbiAgICAgIC5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0ubGFiZWwuc3RhcnRzV2l0aChxdWVyeSkpO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBJRGF0ZUNvbXBsZXRpb24sIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLnNldFRleHQoc3VnZ2VzdGlvbi5sYWJlbCk7XG4gIH1cblxuICBzZWxlY3RTdWdnZXN0aW9uKFxuICAgIHN1Z2dlc3Rpb246IElEYXRlQ29tcGxldGlvbixcbiAgICBldmVudDogS2V5Ym9hcmRFdmVudCB8IE1vdXNlRXZlbnRcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgY29udGV4dCA9IHRoaXMuY29udGV4dDtcbiAgICBpZiAoIWNvbnRleHQpIHJldHVybjtcblxuICAgIGNvbnN0IHsgZWRpdG9yIH0gPSBjb250ZXh0O1xuXG4gICAgY29uc3Qgc2tpcEFsaWFzID0gZXZlbnQuc2hpZnRLZXk7XG4gICAgbGV0IG1ha2VJbnRvTGluayA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dG9zdWdnZXN0VG9nZ2xlTGluaztcblxuICAgIGNvbnN0IHBhcnNlZERhdGUgPSB0aGlzLnBsdWdpbi5wYXJzZURhdGUoc3VnZ2VzdGlvbi5sYWJlbCk7XG4gICAgbGV0IGRhdGVTdHIgPSBwYXJzZWREYXRlLmZvcm1hdHRlZFN0cmluZztcblxuICAgIGlmIChtYWtlSW50b0xpbmspIHtcbiAgICAgIGNvbnN0IGFsaWFzID0gc2tpcEFsaWFzXG4gICAgICAgID8gdW5kZWZpbmVkXG4gICAgICAgIDogZ2V0RGF0ZUxpbmtBbGlhcyh0aGlzLnBsdWdpbiwgc3VnZ2VzdGlvbi5sYWJlbCwgZmFsc2UpIHx8IGNvbnRleHQucXVlcnkgfHwgc3VnZ2VzdGlvbi5sYWJlbDtcbiAgICAgIGRhdGVTdHIgPSBnZW5lcmF0ZU1hcmtkb3duTGluayh0aGlzLmFwcCwgZGF0ZVN0ciwgYWxpYXMpO1xuICAgIH1cblxuICAgIGVkaXRvci5yZXBsYWNlUmFuZ2UoZGF0ZVN0ciwgY29udGV4dC5zdGFydCwgY29udGV4dC5lbmQpO1xuICAgIHRoaXMuY2xvc2UoKTtcbiAgfVxuXG4gIG9uVHJpZ2dlcihcbiAgICBjdXJzb3I6IEVkaXRvclBvc2l0aW9uLFxuICAgIGVkaXRvcjogRWRpdG9yXG4gICk6IEVkaXRvclN1Z2dlc3RUcmlnZ2VySW5mbyB8IG51bGwge1xuICAgIGlmICghdGhpcy5wbHVnaW4uc2V0dGluZ3MuaXNBdXRvc3VnZ2VzdEVuYWJsZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHRyaWdnZXJQaHJhc2UgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvY29tcGxldGVUcmlnZ2VyUGhyYXNlO1xuICAgIGNvbnN0IHN0YXJ0UG9zID0gdGhpcy5jb250ZXh0Py5zdGFydCB8fCB7XG4gICAgICBsaW5lOiBjdXJzb3IubGluZSxcbiAgICAgIGNoOiBjdXJzb3IuY2ggLSB0cmlnZ2VyUGhyYXNlLmxlbmd0aCxcbiAgICB9O1xuXG4gICAgaWYgKCFlZGl0b3IuZ2V0UmFuZ2Uoc3RhcnRQb3MsIGN1cnNvcikuc3RhcnRzV2l0aCh0cmlnZ2VyUGhyYXNlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgcHJlY2VkaW5nQ2hhciA9IGVkaXRvci5nZXRSYW5nZShcbiAgICAgIHtcbiAgICAgICAgbGluZTogc3RhcnRQb3MubGluZSxcbiAgICAgICAgY2g6IHN0YXJ0UG9zLmNoIC0gMSxcbiAgICAgIH0sXG4gICAgICBzdGFydFBvc1xuICAgICk7XG5cbiAgICAvLyDpgb/lhY3lnKjpgq7nrrHlnLDlnYDnrYnlnLrmma/or6/op6blj5FcbiAgICBpZiAocHJlY2VkaW5nQ2hhciAmJiAvW2BhLXpBLVowLTldLy50ZXN0KHByZWNlZGluZ0NoYXIpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBxdWVyeSA9IGVkaXRvclxuICAgICAgLmdldFJhbmdlKHN0YXJ0UG9zLCBjdXJzb3IpXG4gICAgICAuc3Vic3RyaW5nKHRyaWdnZXJQaHJhc2UubGVuZ3RoKTtcblxuICAgIC8vIOinpuWPkeWtl+espuWQjue0p+i3n+epuuagvOWImeWPlua2iFxuICAgIGlmIChxdWVyeSA9PT0gXCIgXCIpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzdGFydDogc3RhcnRQb3MsXG4gICAgICBlbmQ6IGN1cnNvcixcbiAgICAgIHF1ZXJ5LFxuICAgIH07XG4gIH1cbn1cbiIsImltcG9ydCB7IE1hcmtkb3duVmlldyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgYWRqdXN0Q3Vyc29yLCBnZXRTZWxlY3RlZFRleHQsIGdldERhdGVMaW5rQWxpYXMgfSBmcm9tIFwiLi91dGlsc1wiO1xuaW1wb3J0IHR5cGUgTmF0dXJhbExhbmd1YWdlRGF0ZXMgZnJvbSBcIi4vbWFpblwiO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFyc2VDb21tYW5kKFxuICBwbHVnaW46IE5hdHVyYWxMYW5ndWFnZURhdGVzLFxuICBtb2RlOiBzdHJpbmdcbik6IHZvaWQge1xuICBjb25zdCB7IHdvcmtzcGFjZSB9ID0gcGx1Z2luLmFwcDtcbiAgY29uc3QgYWN0aXZlVmlldyA9IHdvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XG5cbiAgaWYgKCFhY3RpdmVWaWV3KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZWRpdG9yID0gYWN0aXZlVmlldy5lZGl0b3I7XG4gIGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcbiAgY29uc3Qgc2VsZWN0ZWRUZXh0ID0gZ2V0U2VsZWN0ZWRUZXh0KGVkaXRvcik7XG5cbiAgY29uc3QgZGF0ZSA9IHBsdWdpbi5wYXJzZURhdGUoc2VsZWN0ZWRUZXh0KTtcblxuICBpZiAoIWRhdGUubW9tZW50LmlzVmFsaWQoKSkge1xuICAgIGVkaXRvci5zZXRDdXJzb3Ioe1xuICAgICAgbGluZTogY3Vyc29yLmxpbmUsXG4gICAgICBjaDogY3Vyc29yLmNoLFxuICAgIH0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGxldCBuZXdTdHI6IHN0cmluZztcblxuICBpZiAobW9kZSA9PT0gXCJyZXBsYWNlXCIpIHtcbiAgICBjb25zdCBhbGlhcyA9IGdldERhdGVMaW5rQWxpYXMocGx1Z2luLCBzZWxlY3RlZFRleHQsIGZhbHNlKTtcbiAgICBuZXdTdHIgPSBhbGlhc1xuICAgICAgPyBgW1ske2RhdGUuZm9ybWF0dGVkU3RyaW5nfXwke2FsaWFzfV1dYFxuICAgICAgOiBgW1ske2RhdGUuZm9ybWF0dGVkU3RyaW5nfV1dYDtcbiAgfSBlbHNlIGlmIChtb2RlID09PSBcImxpbmtcIikge1xuICAgIG5ld1N0ciA9IGBbJHtzZWxlY3RlZFRleHR9XSgke2RhdGUuZm9ybWF0dGVkU3RyaW5nfSlgO1xuICB9IGVsc2UgaWYgKG1vZGUgPT09IFwiY2xlYW5cIikge1xuICAgIG5ld1N0ciA9IGRhdGUuZm9ybWF0dGVkU3RyaW5nO1xuICB9XG5cbiAgZWRpdG9yLnJlcGxhY2VTZWxlY3Rpb24obmV3U3RyISk7XG4gIGFkanVzdEN1cnNvcihlZGl0b3IsIGN1cnNvciwgbmV3U3RyISwgc2VsZWN0ZWRUZXh0KTtcbiAgZWRpdG9yLmZvY3VzKCk7XG59IiwiaW1wb3J0IHsgTm90aWNlLCBTdWdnZXN0TW9kYWwsIEFwcCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZ2V0T3JDcmVhdGVEYWlseU5vdGUgfSBmcm9tIFwiLi4vdXRpbHNcIjtcbmltcG9ydCB0eXBlIE5hdHVyYWxMYW5ndWFnZURhdGVzIGZyb20gXCIuLi9tYWluXCI7XG5pbXBvcnQgRGF0ZVN1Z2dlc3QgZnJvbSBcIi4uL3N1Z2dlc3QvZGF0ZS1zdWdnZXN0XCI7XG5cbmV4cG9ydCBjbGFzcyBPcGVuRGFpbHlOb3RlTW9kYWwgZXh0ZW5kcyBTdWdnZXN0TW9kYWw8c3RyaW5nPiB7XG4gIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXM7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogTmF0dXJhbExhbmd1YWdlRGF0ZXMpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMucGx1Z2luID0gcGx1Z2luO1xuICAgIHRoaXMuc2V0UGxhY2Vob2xkZXIoXCLovpPlhaXkuK3mlofml6XmnJ/vvIzlpoLvvJrku4rlpKnjgIHkuIvlkajkuInjgIEz5aSp5ZCOXCIpO1xuICB9XG5cbiAgZ2V0U3VnZ2VzdGlvbnMocXVlcnk6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCB0ZW1wU3VnZ2VzdCA9IG5ldyBEYXRlU3VnZ2VzdCh0aGlzLmFwcCwgdGhpcy5wbHVnaW4pO1xuICAgIGNvbnN0IHN1Z2dlc3Rpb25zID0gdGVtcFN1Z2dlc3QuZ2V0RGF0ZVN1Z2dlc3Rpb25zKFxuICAgICAgeyBxdWVyeSB9LFxuICAgICAgW1wi5LuK5aSpXCIsIFwi5pio5aSpXCIsIFwi5piO5aSpXCJdXG4gICAgKTtcbiAgICByZXR1cm4gc3VnZ2VzdGlvbnMubWFwKChzKSA9PiBzLmxhYmVsKS5sZW5ndGhcbiAgICAgID8gc3VnZ2VzdGlvbnMubWFwKChzKSA9PiBzLmxhYmVsKVxuICAgICAgOiBbcXVlcnldO1xuICB9XG5cbiAgcmVuZGVyU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBzdHJpbmcsIGVsOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogc3VnZ2VzdGlvbiB9KTtcbiAgfVxuXG4gIG9uQ2hvb3NlU3VnZ2VzdGlvbihzdWdnZXN0aW9uOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCBwYXJzZWREYXRlID0gdGhpcy5wbHVnaW4ucGFyc2VEYXRlKHN1Z2dlc3Rpb24pO1xuICAgIGNvbnN0IGRhdGUgPSBwYXJzZWREYXRlLm1vbWVudDtcbiAgICBpZiAoIXBhcnNlZERhdGUuZGF0ZSB8fCAhZGF0ZS5pc1ZhbGlkKCkpIHtcbiAgICAgIG5ldyBOb3RpY2UoXCLml6Dms5Xop6PmnpDor6Xml6XmnJ9cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdm9pZCBnZXRPckNyZWF0ZURhaWx5Tm90ZShkYXRlKS50aGVuKChub3RlKSA9PiB7XG4gICAgICBpZiAobm90ZSkge1xuICAgICAgICB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUobm90ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1hcmtkb3duVmlldywgT2JzaWRpYW5Qcm90b2NvbERhdGEsIFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuXG5pbXBvcnQgTkxEUGFyc2VyLCB7IE5MRFJlc3VsdCB9IGZyb20gXCIuL3BhcnNlclwiO1xuaW1wb3J0IHsgTkxEU2V0dGluZ3NUYWIsIE5MRFNldHRpbmdzLCBERUZBVUxUX1NFVFRJTkdTIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcbmltcG9ydCBEYXRlU3VnZ2VzdCBmcm9tIFwiLi9zdWdnZXN0L2RhdGUtc3VnZ2VzdFwiO1xuaW1wb3J0IHsgZ2V0UGFyc2VDb21tYW5kIH0gZnJvbSBcIi4vY29tbWFuZHNcIjtcbmltcG9ydCB7IGdldEZvcm1hdHRlZERhdGUsIGdldE9yQ3JlYXRlRGFpbHlOb3RlLCBwYXJzZVRydXRoeSB9IGZyb20gXCIuL3V0aWxzXCI7XG5pbXBvcnQgeyBPcGVuRGFpbHlOb3RlTW9kYWwgfSBmcm9tIFwiLi9tb2RhbHMvb3Blbi1kYWlseS1ub3RlXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE5hdHVyYWxMYW5ndWFnZURhdGVzIGV4dGVuZHMgUGx1Z2luIHtcbiAgcHJpdmF0ZSBwYXJzZXI6IE5MRFBhcnNlcjtcbiAgcHVibGljIHNldHRpbmdzOiBOTERTZXR0aW5ncztcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJubHAtZGF0ZXNcIixcbiAgICAgIG5hbWU6IFwi6Kej5p6Q6Ieq54S26K+t6KiA5pel5pyfXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4gZ2V0UGFyc2VDb21tYW5kKHRoaXMsIFwicmVwbGFjZVwiKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJubHAtZGF0ZS1jbGVhblwiLFxuICAgICAgbmFtZTogXCLop6PmnpDoh6rnhLbor63oqIDml6XmnJ/vvIjnuq/mlofmnKzvvIlcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiBnZXRQYXJzZUNvbW1hbmQodGhpcywgXCJjbGVhblwiKSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJubHAtb3Blbi1kYWlseS1ub3RlXCIsXG4gICAgICBuYW1lOiBcIueUqOiHqueEtuivreiogOaJk+W8gOaXpeiusFwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHtcbiAgICAgICAgY29uc3QgbW9kYWwgPSBuZXcgT3BlbkRhaWx5Tm90ZU1vZGFsKHRoaXMuYXBwLCB0aGlzKTtcbiAgICAgICAgbW9kYWwub3BlbigpO1xuICAgICAgfSxcbiAgICB9KTtcblxuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgTkxEU2V0dGluZ3NUYWIodGhpcy5hcHAsIHRoaXMpKTtcbiAgICB0aGlzLnJlZ2lzdGVyT2JzaWRpYW5Qcm90b2NvbEhhbmRsZXIoXG4gICAgICBcIm5sZGF0ZXNcIixcbiAgICAgIChwYXJhbXMpID0+IHZvaWQgdGhpcy5hY3Rpb25IYW5kbGVyKHBhcmFtcylcbiAgICApO1xuICAgIHRoaXMucmVnaXN0ZXJFZGl0b3JTdWdnZXN0KG5ldyBEYXRlU3VnZ2VzdCh0aGlzLmFwcCwgdGhpcykpO1xuXG4gICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4ge1xuICAgICAgdGhpcy5wYXJzZXIgPSBuZXcgTkxEUGFyc2VyKCk7XG4gICAgfSk7XG4gIH1cblxuICBvbnVubG9hZCgpOiB2b2lkIHtcbiAgICBjb25zb2xlLmRlYnVnKFwi5Y246L296Ieq54S26K+t6KiA5pel5pyf5o+S5Lu277yI5Lit5paH77yJXCIpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKFxuICAgICAge30sXG4gICAgICBERUZBVUxUX1NFVFRJTkdTLFxuICAgICAgKGF3YWl0IHRoaXMubG9hZERhdGEoKSkgYXMgUGFydGlhbDxOTERTZXR0aW5ncz5cbiAgICApO1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBwYXJzZShkYXRlU3RyaW5nOiBzdHJpbmcsIGZvcm1hdDogc3RyaW5nKTogTkxEUmVzdWx0IHtcbiAgICBjb25zdCBkYXRlID0gdGhpcy5wYXJzZXIuZ2V0UGFyc2VkRGF0ZShcbiAgICAgIGRhdGVTdHJpbmcsXG4gICAgICB0aGlzLnNldHRpbmdzLndlZWtTdGFydFxuICAgICk7XG4gICAgY29uc3QgZm9ybWF0dGVkU3RyaW5nID0gZ2V0Rm9ybWF0dGVkRGF0ZShkYXRlLCBmb3JtYXQpO1xuICAgIGlmIChmb3JtYXR0ZWRTdHJpbmcgPT09IFwiSW52YWxpZCBkYXRlXCIpIHtcbiAgICAgIGNvbnNvbGUuZGVidWcoYG5sZGF0ZXMg5peg5rOV6Kej5p6Q6L6T5YWlIFwiJHtkYXRlU3RyaW5nfVwiYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGZvcm1hdHRlZFN0cmluZyxcbiAgICAgIGRhdGUsXG4gICAgICBtb21lbnQ6IHdpbmRvdy5tb21lbnQoZGF0ZSksXG4gICAgfTtcbiAgfVxuXG4gIHBhcnNlRGF0ZShkYXRlU3RyaW5nOiBzdHJpbmcpOiBOTERSZXN1bHQge1xuICAgIHJldHVybiB0aGlzLnBhcnNlKGRhdGVTdHJpbmcsIHRoaXMuc2V0dGluZ3MuZm9ybWF0KTtcbiAgfVxuXG4gIGFzeW5jIGFjdGlvbkhhbmRsZXIocGFyYW1zOiBPYnNpZGlhblByb3RvY29sRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgd29ya3NwYWNlIH0gPSB0aGlzLmFwcDtcblxuICAgIGNvbnN0IGRhdGUgPSB0aGlzLnBhcnNlRGF0ZShwYXJhbXMuZGF5KTtcbiAgICBjb25zdCBuZXdQYW5lID0gcGFyc2VUcnV0aHkocGFyYW1zLm5ld1BhbmUgfHwgXCJ5ZXNcIik7XG5cbiAgICBpZiAoZGF0ZS5tb21lbnQuaXNWYWxpZCgpKSB7XG4gICAgICBjb25zdCBkYWlseU5vdGUgPSBhd2FpdCBnZXRPckNyZWF0ZURhaWx5Tm90ZShkYXRlLm1vbWVudCk7XG4gICAgICBpZiAoZGFpbHlOb3RlKSB7XG4gICAgICAgIGF3YWl0IHdvcmtzcGFjZS5nZXRMZWFmKG5ld1BhbmUpLm9wZW5GaWxlKGRhaWx5Tm90ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOlsiWUVBUl9QQVRURVJOIiwiUEFUVEVSTiIsIkRBVEVfR1JPVVAiLCJEQVRFX1RPX0dST1VQIiwiTU9OVEhfTkFNRV9HUk9VUCIsIllFQVJfR1JPVVAiLCJQUkVGSVhfR1JPVVAiLCJZRUFSX05VTUJFUl9HUk9VUCIsIk1PTlRIX05VTUJFUl9HUk9VUCIsIkRBVEVfTlVNQkVSX0dST1VQIiwiTU9OVEhfR1JPVVAiLCJIT1VSX0dST1VQIiwiTUlOVVRFX0dST1VQIiwiU0VDT05EX0dST1VQIiwiQU1fUE1fSE9VUl9HUk9VUCIsIlNUUklDVF9QQVRURVJOIiwiZGF0ZXMuaW1wbHlTaW1pbGFyRGF0ZSIsInJlZmVyZW5jZXMubm93IiwicmVmZXJlbmNlcy50b2RheSIsInJlZmVyZW5jZXMueWVzdGVyZGF5IiwicmVmZXJlbmNlcy50b21vcnJvdyIsInJlZmVyZW5jZXMudG9uaWdodCIsInJlZmVyZW5jZXMudGhlRGF5QWZ0ZXIiLCJjYXN1YWxSZWZlcmVuY2VzLmFmdGVybm9vbiIsImNhc3VhbFJlZmVyZW5jZXMuZXZlbmluZyIsImNhc3VhbFJlZmVyZW5jZXMubWlkbmlnaHQiLCJjYXN1YWxSZWZlcmVuY2VzLm1vcm5pbmciLCJjYXN1YWxSZWZlcmVuY2VzLm5vb24iLCJEQVlfR1JPVVBfMSIsIkRBWV9HUk9VUF8zIiwibm9ybWFsaXplUGF0aCIsIk5vdGljZSIsIlZhdWx0IiwiVEZpbGUiLCJjaHJvbm8uemguaGFucy5jcmVhdGVDYXN1YWxDb25maWd1cmF0aW9uIiwibW9tZW50IiwiUGx1Z2luU2V0dGluZ1RhYiIsIlNldHRpbmciLCJFZGl0b3JTdWdnZXN0IiwiTWFya2Rvd25WaWV3IiwiU3VnZ2VzdE1vZGFsIiwiUGx1Z2luIl0sIm1hcHBpbmdzIjoiOzs7O0FBQU8sSUFBSSxRQUFRLENBQUM7QUFDcEIsQ0FBQyxVQUFVLFFBQVEsRUFBRTtBQUNyQixJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO0FBQ3hDLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDeEMsQ0FBQyxFQUFFLFFBQVEsS0FBSyxRQUFRLEdBQUcsRUFBRSxDQUFDLENBQUMs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QyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEtBQUssRUFBRSxHQUFHO0FBQ2QsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEtBQUssRUFBRSxHQUFHO0FBQ2QsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxLQUFLLEVBQUUsR0FBRztBQUNkLElBQUksSUFBSSxFQUFFLEdBQUc7QUFDYixJQUFJLElBQUksRUFBRSxDQUFDLEdBQUc7QUFDZCxJQUFJLElBQUksRUFBRSxHQUFHO0FBQ2IsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFBSSxJQUFJLEVBQUUsR0FBRztBQUNiLElBQUksR0FBRyxFQUFFLEVBQUU7QUFDWCxJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsR0FBRztBQUNaLElBQUksR0FBRyxFQUFFLEdBQUc7QUFDWixJQUFJLEdBQUcsRUFBRSxHQUFHO0FBQ1osSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHO0FBQ2IsSUFB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QUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDeEMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekMsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0MsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUN2QixRQUFRLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0MsUUFBUSxPQUFPLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixLQUFLO0FBQ0wsSUFBSSxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUN4QixRQUFRLFFBQVEsQ0FBQyxhQUFhLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakQsUUFBUSxPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixLQUFLO0FBQ0wsSUFBSSxJQUFJLE1BQU0sSUFBSSxRQUFRLEVBQUU7QUFDNUIsUUFBUSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFN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QzFCLFNBQVM7QUFDVCxRQUFRLElBQUksUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUM3QixZQUFZLFFBQVEsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3JDLFNBQVM7QUFDVCxhQUFhLElBQUksUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNsQyxZQUFZLFFBQVEsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3JDLFNBQVM7QUFDVCxhQUFhLElBQUksUUFBUSxJQUFJLEdBQUcsSUFBSSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ3JELFlBQVksUUFBUSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUM7QUFDbkMsU0FBUztBQUNULFFBQVEsTUFBTSxJQUFJLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDNUQsUUFBUSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDdkQsUUFBUSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3pELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ2xELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBQ3JELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQ3pELFFBQVEsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQ3pELFFBQVEsT0FBTyxNQUFNLENBQUM7QUFDdEIsS0FBSztBQUNMOztB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QUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUM1QixLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7SUFDN0IsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzdCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUM1QixLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDM0IsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzdCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUM3QixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7O0lBRTNCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtJQUMzQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7SUFDM0IsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFO0lBQzVCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUM3QixLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7SUFDNUIsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQzNCLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVB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

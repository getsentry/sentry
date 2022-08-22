(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/hi"],{

/***/ "../node_modules/moment/locale/hi.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/hi.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Hindi [hi]
//! author : Mayank Singhal : https://github.com/mayanksinghal

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var symbolMap = {
            1: '१',
            2: '२',
            3: '३',
            4: '४',
            5: '५',
            6: '६',
            7: '७',
            8: '८',
            9: '९',
            0: '०',
        },
        numberMap = {
            '१': '1',
            '२': '2',
            '३': '3',
            '४': '4',
            '५': '5',
            '६': '6',
            '७': '7',
            '८': '8',
            '९': '9',
            '०': '0',
        },
        monthsParse = [
            /^जन/i,
            /^फ़र|फर/i,
            /^मार्च/i,
            /^अप्रै/i,
            /^मई/i,
            /^जून/i,
            /^जुल/i,
            /^अग/i,
            /^सितं|सित/i,
            /^अक्टू/i,
            /^नव|नवं/i,
            /^दिसं|दिस/i,
        ],
        shortMonthsParse = [
            /^जन/i,
            /^फ़र/i,
            /^मार्च/i,
            /^अप्रै/i,
            /^मई/i,
            /^जून/i,
            /^जुल/i,
            /^अग/i,
            /^सित/i,
            /^अक्टू/i,
            /^नव/i,
            /^दिस/i,
        ];

    var hi = moment.defineLocale('hi', {
        months: {
            format: 'जनवरी_फ़रवरी_मार्च_अप्रैल_मई_जून_जुलाई_अगस्त_सितम्बर_अक्टूबर_नवम्बर_दिसम्बर'.split(
                '_'
            ),
            standalone:
                'जनवरी_फरवरी_मार्च_अप्रैल_मई_जून_जुलाई_अगस्त_सितंबर_अक्टूबर_नवंबर_दिसंबर'.split(
                    '_'
                ),
        },
        monthsShort:
            'जन._फ़र._मार्च_अप्रै._मई_जून_जुल._अग._सित._अक्टू._नव._दिस.'.split('_'),
        weekdays: 'रविवार_सोमवार_मंगलवार_बुधवार_गुरूवार_शुक्रवार_शनिवार'.split('_'),
        weekdaysShort: 'रवि_सोम_मंगल_बुध_गुरू_शुक्र_शनि'.split('_'),
        weekdaysMin: 'र_सो_मं_बु_गु_शु_श'.split('_'),
        longDateFormat: {
            LT: 'A h:mm बजे',
            LTS: 'A h:mm:ss बजे',
            L: 'DD/MM/YYYY',
            LL: 'D MMMM YYYY',
            LLL: 'D MMMM YYYY, A h:mm बजे',
            LLLL: 'dddd, D MMMM YYYY, A h:mm बजे',
        },

        monthsParse: monthsParse,
        longMonthsParse: monthsParse,
        shortMonthsParse: shortMonthsParse,

        monthsRegex:
            /^(जनवरी|जन\.?|फ़रवरी|फरवरी|फ़र\.?|मार्च?|अप्रैल|अप्रै\.?|मई?|जून?|जुलाई|जुल\.?|अगस्त|अग\.?|सितम्बर|सितंबर|सित\.?|अक्टूबर|अक्टू\.?|नवम्बर|नवंबर|नव\.?|दिसम्बर|दिसंबर|दिस\.?)/i,

        monthsShortRegex:
            /^(जनवरी|जन\.?|फ़रवरी|फरवरी|फ़र\.?|मार्च?|अप्रैल|अप्रै\.?|मई?|जून?|जुलाई|जुल\.?|अगस्त|अग\.?|सितम्बर|सितंबर|सित\.?|अक्टूबर|अक्टू\.?|नवम्बर|नवंबर|नव\.?|दिसम्बर|दिसंबर|दिस\.?)/i,

        monthsStrictRegex:
            /^(जनवरी?|फ़रवरी|फरवरी?|मार्च?|अप्रैल?|मई?|जून?|जुलाई?|अगस्त?|सितम्बर|सितंबर|सित?\.?|अक्टूबर|अक्टू\.?|नवम्बर|नवंबर?|दिसम्बर|दिसंबर?)/i,

        monthsShortStrictRegex:
            /^(जन\.?|फ़र\.?|मार्च?|अप्रै\.?|मई?|जून?|जुल\.?|अग\.?|सित\.?|अक्टू\.?|नव\.?|दिस\.?)/i,

        calendar: {
            sameDay: '[आज] LT',
            nextDay: '[कल] LT',
            nextWeek: 'dddd, LT',
            lastDay: '[कल] LT',
            lastWeek: '[पिछले] dddd, LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: '%s में',
            past: '%s पहले',
            s: 'कुछ ही क्षण',
            ss: '%d सेकंड',
            m: 'एक मिनट',
            mm: '%d मिनट',
            h: 'एक घंटा',
            hh: '%d घंटे',
            d: 'एक दिन',
            dd: '%d दिन',
            M: 'एक महीने',
            MM: '%d महीने',
            y: 'एक वर्ष',
            yy: '%d वर्ष',
        },
        preparse: function (string) {
            return string.replace(/[१२३४५६७८९०]/g, function (match) {
                return numberMap[match];
            });
        },
        postformat: function (string) {
            return string.replace(/\d/g, function (match) {
                return symbolMap[match];
            });
        },
        // Hindi notation for meridiems are quite fuzzy in practice. While there exists
        // a rigid notion of a 'Pahar' it is not used as rigidly in modern Hindi.
        meridiemParse: /रात|सुबह|दोपहर|शाम/,
        meridiemHour: function (hour, meridiem) {
            if (hour === 12) {
                hour = 0;
            }
            if (meridiem === 'रात') {
                return hour < 4 ? hour : hour + 12;
            } else if (meridiem === 'सुबह') {
                return hour;
            } else if (meridiem === 'दोपहर') {
                return hour >= 10 ? hour : hour + 12;
            } else if (meridiem === 'शाम') {
                return hour + 12;
            }
        },
        meridiem: function (hour, minute, isLower) {
            if (hour < 4) {
                return 'रात';
            } else if (hour < 10) {
                return 'सुबह';
            } else if (hour < 17) {
                return 'दोपहर';
            } else if (hour < 20) {
                return 'शाम';
            } else {
                return 'रात';
            }
        },
        week: {
            dow: 0, // Sunday is the first day of the week.
            doy: 6, // The week that contains Jan 6th is the first week of the year.
        },
    });

    return hi;

})));


/***/ }),

/***/ "../src/sentry/locale/hi/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/hi/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Remove":["हटाएँ"],"Priority":["प्राथमिकता"],"Last Seen":["आखरी बार देखा"],"First Seen":["पहली बार देखा"],"Frequency":["आवृत्ति"],"Score":["स्कोर"],"Name":["नाम"],"URL":["यूआरएल"],"Project":["परियोजना"],"Unresolved":["अविश्लेषित"],"Resolved":["विश्लेषित"],"error":["त्रुटि"],"Events":["स्पर्धाएँ"],"Users":["उपयोगकर्ताओं"],"user":["उपयोगकर्ता"],"Page Not Found":["पृष्ठ नहीं मिला"],"The page you are looking for was not found.":["आप जिस पृष्ठ को देख रहे है वह नहीं मिला ."],"Cancel":["रद्द करें"],"Submit":["प्रस्तुत करे "],"Next":["अगला"],"Save Changes":["परिवर्तन सहेजें"],"Query":["प्रश्न"],"ID:":["आईडी:"],"Username:":["उपयोक्तानाम:"],"m":[" म"],"never":["कभी नहीं"],"1 day":["1 दिन"],"Account":["खाता"],"Projects":["परियोजनाओं"],"Details":["विवरण"],"Exception":["अपवाद"],"Previous":["पूर्व"],"Confirm":["पुष्टि करें"],"User":["उपयोगकर्ता"],"Language":["भाषा"],"Status":["स्थिति"],"Actions":["कार्रवाई"],"Raw":["रॉ"],"Additional Data":["अतिरिक्त डेटा"],"Level":["स्तर"],"Message":["संदेश"],"Cookies":["कुकीज़"],"Headers":["शीर्षलेख"],"Environment":["परिवेश"],"Body":["बॉडी"],"Packages":["पैकेजों"],"Regression":["रीग्रेसन"],"All":["सारे"],"Project Details":["परियोजना विवरण"],"Stats":["आँकड़े"],"Settings":["सेटिंग्स"],"Members":["सदस्यों"],"Admin":["व्यवस्थापक"],"n/a":["n/a"],"Queue":["श्रेणी"],"Mail":["डाक"],"Configuration":["विन्यास"],"Server Version":["सर्वर संस्करण"],"Python Version":["पाइथन संस्करण"],"Configuration File":["विन्यास फ़ाइल"],"Uptime":["अपटाइम"],"Environment not found (are you using the builtin Sentry webserver?).":["परिवेश नहीं मिला (आप सेंट्री वेब सर्वर में निर्मित का उपयोग कर रहे हैं ?)."],"Extensions":["एक्सटेंशन"],"Modules":["अनुखंड"],"Disable the account.":["खाते को अक्षम करें."],"Permanently remove the user and their data.":["स्थायी रूप से उपयोगकर्ता और अपने डेटा को हटायें."],"Remove User":["उपयोगकर्ता हटायें"],"24 hours":["24 घंटे"],"30 days":["30 दिनों"],"Login":["लॉग इन करें"],"All Events":["सभी घटना"],"Bookmark":["पुस्तचिह्न"],"Event Details":["ईवेंट विवरण"],"Overview":["अवलोकन"],"Restore":["पुरानी स्तिथी में लाऐं"],"Last Event":["आखरी घटना"],"Search":["खोजें"],"Revoke":["हटा"],"Dashboard":["नियंत्रण-पट्ट"],"Public Key":["सार्वजनिक कुंजी"],"Secret Key":["गुप्त कुंजी"],"Client Configuration":["क्लाइंट विन्यास"],"Remove Project":["परियोजना हटायें"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"hi"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/hi.69429dd12f3cf1e953d217becf15eff1.js.map
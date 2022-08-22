(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/af"],{

/***/ "../node_modules/moment/locale/af.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/af.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Afrikaans [af]
//! author : Werner Mollentze : https://github.com/wernerm

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var af = moment.defineLocale('af', {
        months: 'Januarie_Februarie_Maart_April_Mei_Junie_Julie_Augustus_September_Oktober_November_Desember'.split(
            '_'
        ),
        monthsShort: 'Jan_Feb_Mrt_Apr_Mei_Jun_Jul_Aug_Sep_Okt_Nov_Des'.split('_'),
        weekdays: 'Sondag_Maandag_Dinsdag_Woensdag_Donderdag_Vrydag_Saterdag'.split(
            '_'
        ),
        weekdaysShort: 'Son_Maa_Din_Woe_Don_Vry_Sat'.split('_'),
        weekdaysMin: 'So_Ma_Di_Wo_Do_Vr_Sa'.split('_'),
        meridiemParse: /vm|nm/i,
        isPM: function (input) {
            return /^nm$/i.test(input);
        },
        meridiem: function (hours, minutes, isLower) {
            if (hours < 12) {
                return isLower ? 'vm' : 'VM';
            } else {
                return isLower ? 'nm' : 'NM';
            }
        },
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD/MM/YYYY',
            LL: 'D MMMM YYYY',
            LLL: 'D MMMM YYYY HH:mm',
            LLLL: 'dddd, D MMMM YYYY HH:mm',
        },
        calendar: {
            sameDay: '[Vandag om] LT',
            nextDay: '[Môre om] LT',
            nextWeek: 'dddd [om] LT',
            lastDay: '[Gister om] LT',
            lastWeek: '[Laas] dddd [om] LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: 'oor %s',
            past: '%s gelede',
            s: "'n paar sekondes",
            ss: '%d sekondes',
            m: "'n minuut",
            mm: '%d minute',
            h: "'n uur",
            hh: '%d ure',
            d: "'n dag",
            dd: '%d dae',
            M: "'n maand",
            MM: '%d maande',
            y: "'n jaar",
            yy: '%d jaar',
        },
        dayOfMonthOrdinalParse: /\d{1,2}(ste|de)/,
        ordinal: function (number) {
            return (
                number +
                (number === 1 || number === 8 || number >= 20 ? 'ste' : 'de')
            ); // Thanks to Joris Röling : https://github.com/jjupiter
        },
        week: {
            dow: 1, // Maandag is die eerste dag van die week.
            doy: 4, // Die week wat die 4de Januarie bevat is die eerste week van die jaar.
        },
    });

    return af;

})));


/***/ }),

/***/ "../src/sentry/locale/af/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/af/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Priority":["Prioriteit"],"Last Seen":["Laas Gesien"],"First Seen":["Eerste Gesien"],"Frequency":["Frekwensie"],"Score":["Telling"],"Name":["Naam"],"URL":["URL"],"Project":["Projek"],"error":["fout"],"Events":["Gevalle"],"Users":["Gebruikers"],"user":["gebruiker"],"Page Not Found":["Bladsy Nie Gevind"],"The page you are looking for was not found.":["Die bladsy wat jy soek was nie gevind nie."],"Cancel":["kanselleer"],"Submit":["Stuur"],"Next":["Volgende"],"Save Changes":["Stoor Veranderinge"],"never":["nooit"],"1 day":["1 dag"],"Account":["Rekening"],"Projects":["Projekte"],"Details":["Besonderhede"],"Previous":["Vorige"],"Confirm":["Bevestig"],"User":["Gebruiker"],"Status":["Status"],"Actions":["Aksies"],"Additional Data":["Addisionele Data"],"Message":["Boodskap"],"Cookies":["Koekies"],"Headers":["Hoofde"],"Environment":["Omgewing"],"Body":["Lyf"],"Packages":["Pakkette"],"All":["Alles"],"Project Details":["Projek Besonderhede"],"Stats":["Stat."],"Members":["Lede"],"Queue":["Tou"],"Mail":["Pos"],"Configuration":["Konfigurasie"],"Server Version":["Bediener Weergawe"],"Python Version":["Python Weergawe"],"Configuration File":["Konfigurasielêer"],"Environment not found (are you using the builtin Sentry webserver?).":["Omgewing nie gevind nie (gebruik jy die ingeboude Sentry webbediener?)."],"Extensions":["Uitbreidings"],"Modules":["Modules"],"Remove User":["Verwyder Gebruiker"],"24 hours":["24 ure"],"30 days":["30 dae"],"All Events":["Alle Gevalle"],"Event Details":["Geval Besonderhede"],"Overview":["Oorsig"],"Last Event":["Laaste Geval"],"Search":["Soek"],"Revoke":["Herroep"],"Dashboard":["Paneelbord"],"Public Key":["Publieke Sleutel"],"Secret Key":["Geheime Sleutel"],"Remove Project":["Verwyder Projek"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"af"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/af.4730d48450bf33144c8a7c058867c4f3.js.map
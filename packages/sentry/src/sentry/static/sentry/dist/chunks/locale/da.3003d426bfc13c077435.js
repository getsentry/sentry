(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/da"],{

/***/ "../node_modules/moment/locale/da.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/da.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Danish [da]
//! author : Ulrik Nielsen : https://github.com/mrbase

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var da = moment.defineLocale('da', {
        months: 'januar_februar_marts_april_maj_juni_juli_august_september_oktober_november_december'.split(
            '_'
        ),
        monthsShort: 'jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec'.split('_'),
        weekdays: 'søndag_mandag_tirsdag_onsdag_torsdag_fredag_lørdag'.split('_'),
        weekdaysShort: 'søn_man_tir_ons_tor_fre_lør'.split('_'),
        weekdaysMin: 'sø_ma_ti_on_to_fr_lø'.split('_'),
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD.MM.YYYY',
            LL: 'D. MMMM YYYY',
            LLL: 'D. MMMM YYYY HH:mm',
            LLLL: 'dddd [d.] D. MMMM YYYY [kl.] HH:mm',
        },
        calendar: {
            sameDay: '[i dag kl.] LT',
            nextDay: '[i morgen kl.] LT',
            nextWeek: 'på dddd [kl.] LT',
            lastDay: '[i går kl.] LT',
            lastWeek: '[i] dddd[s kl.] LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: 'om %s',
            past: '%s siden',
            s: 'få sekunder',
            ss: '%d sekunder',
            m: 'et minut',
            mm: '%d minutter',
            h: 'en time',
            hh: '%d timer',
            d: 'en dag',
            dd: '%d dage',
            M: 'en måned',
            MM: '%d måneder',
            y: 'et år',
            yy: '%d år',
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal: '%d.',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return da;

})));


/***/ }),

/***/ "../src/sentry/locale/da/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/da/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Remove":["Fjern"],"Priority":["Prioritet"],"Last Seen":["Sidst set"],"First Seen":["Først set"],"Frequency":["Frekvens"],"Score":["Score"],"Name":["Navn"],"URL":["URL"],"Project":["Projekt"],"Unresolved":["Uløst"],"Resolved":["Løst"],"error":["fejl"],"Events":["Begivenheder"],"Users":["Brugere"],"Page Not Found":["Siden blev ikke fundet"],"The page you are looking for was not found.":["Den side du leder efter blev ikke fundet."],"Cancel":["Afbryd"],"Submit":["Indsend"],"Next":["Næste"],"Register":["Registrer dig"],"Save Changes":["Gem ændringer"],"ID:":["ID:"],"Username:":["Brugernavn:"],"never":["aldrig"],"1 day":["1 dag"],"Account":["Konto"],"Email":["Email"],"Projects":["Projekter"],"Details":["Detaljer"],"Exception":["Undtagelse"],"Tags":["Tags"],"Previous":["Forrige"],"Confirm":["Bekræft"],"Operating System":["Operativsystem"],"User":["Bruger"],"Language":["Sprog"],"Status":["Status"],"Actions":["Handlinger"],"Raw":["Rå"],"Additional Data":["Yderligere data"],"Level":["Niveau"],"Environment":["Miljø"],"Packages":["Pakker"],"Regression":["Regression"],"Project Details":["Projektdetaljer"],"Stats":["Statistikker"],"Settings":["Indstillinger"],"Members":["Medlemmer"],"Admin":["Adminstrator"],"n/a":["n/a"],"Mail":["Mail"],"Notifications":["Notifikationer"],"Identities":["Identiteter"],"Configuration":["Konfiguration"],"Create a new account":["Opret en ny konto"],"Server Version":["Server version"],"Python Version":["Python version"],"Configuration File":["Konfigurationsfil"],"Uptime":["Oppetid"],"Environment not found (are you using the builtin Sentry webserver?).":["Miljøet blev ikke fundet (bruger du den indbyggede Sentry webserver?)."],"Extensions":["Udvidelser"],"Modules":["Moduler"],"Disable the account.":["Deaktiver denne bruger."],"Permanently remove the user and their data.":["Fjern denne bruger og deres data permanent."],"Remove User":["Fjern bruger"],"15 minutes":["15 minutter"],"24 hours":["24 timer"],"60 minutes":["60 minutter"],"Login":["Log ind"],"All Events":["Alle begivenheder"],"Bookmark":["Bogmærke"],"Overview":["Overblik"],"Trends":["Tendenser"],"Restore":["Genetabler"],"Search":["Søg"],"Dashboard":["Kontrolpanel"],"Client Configuration":["Klientkonfiguration"],"Remove Project":["Fjern projekt"],"Client Security":["Klientsikkerhed"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"da"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/da.26cbe39c887caa13672115f8851188ec.js.map
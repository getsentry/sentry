(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/sl"],{

/***/ "../node_modules/moment/locale/sl.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/sl.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Slovenian [sl]
//! author : Robert Sedovšek : https://github.com/sedovsek

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    function processRelativeTime(number, withoutSuffix, key, isFuture) {
        var result = number + ' ';
        switch (key) {
            case 's':
                return withoutSuffix || isFuture
                    ? 'nekaj sekund'
                    : 'nekaj sekundami';
            case 'ss':
                if (number === 1) {
                    result += withoutSuffix ? 'sekundo' : 'sekundi';
                } else if (number === 2) {
                    result += withoutSuffix || isFuture ? 'sekundi' : 'sekundah';
                } else if (number < 5) {
                    result += withoutSuffix || isFuture ? 'sekunde' : 'sekundah';
                } else {
                    result += 'sekund';
                }
                return result;
            case 'm':
                return withoutSuffix ? 'ena minuta' : 'eno minuto';
            case 'mm':
                if (number === 1) {
                    result += withoutSuffix ? 'minuta' : 'minuto';
                } else if (number === 2) {
                    result += withoutSuffix || isFuture ? 'minuti' : 'minutama';
                } else if (number < 5) {
                    result += withoutSuffix || isFuture ? 'minute' : 'minutami';
                } else {
                    result += withoutSuffix || isFuture ? 'minut' : 'minutami';
                }
                return result;
            case 'h':
                return withoutSuffix ? 'ena ura' : 'eno uro';
            case 'hh':
                if (number === 1) {
                    result += withoutSuffix ? 'ura' : 'uro';
                } else if (number === 2) {
                    result += withoutSuffix || isFuture ? 'uri' : 'urama';
                } else if (number < 5) {
                    result += withoutSuffix || isFuture ? 'ure' : 'urami';
                } else {
                    result += withoutSuffix || isFuture ? 'ur' : 'urami';
                }
                return result;
            case 'd':
                return withoutSuffix || isFuture ? 'en dan' : 'enim dnem';
            case 'dd':
                if (number === 1) {
                    result += withoutSuffix || isFuture ? 'dan' : 'dnem';
                } else if (number === 2) {
                    result += withoutSuffix || isFuture ? 'dni' : 'dnevoma';
                } else {
                    result += withoutSuffix || isFuture ? 'dni' : 'dnevi';
                }
                return result;
            case 'M':
                return withoutSuffix || isFuture ? 'en mesec' : 'enim mesecem';
            case 'MM':
                if (number === 1) {
                    result += withoutSuffix || isFuture ? 'mesec' : 'mesecem';
                } else if (number === 2) {
                    result += withoutSuffix || isFuture ? 'meseca' : 'mesecema';
                } else if (number < 5) {
                    result += withoutSuffix || isFuture ? 'mesece' : 'meseci';
                } else {
                    result += withoutSuffix || isFuture ? 'mesecev' : 'meseci';
                }
                return result;
            case 'y':
                return withoutSuffix || isFuture ? 'eno leto' : 'enim letom';
            case 'yy':
                if (number === 1) {
                    result += withoutSuffix || isFuture ? 'leto' : 'letom';
                } else if (number === 2) {
                    result += withoutSuffix || isFuture ? 'leti' : 'letoma';
                } else if (number < 5) {
                    result += withoutSuffix || isFuture ? 'leta' : 'leti';
                } else {
                    result += withoutSuffix || isFuture ? 'let' : 'leti';
                }
                return result;
        }
    }

    var sl = moment.defineLocale('sl', {
        months: 'januar_februar_marec_april_maj_junij_julij_avgust_september_oktober_november_december'.split(
            '_'
        ),
        monthsShort:
            'jan._feb._mar._apr._maj._jun._jul._avg._sep._okt._nov._dec.'.split(
                '_'
            ),
        monthsParseExact: true,
        weekdays: 'nedelja_ponedeljek_torek_sreda_četrtek_petek_sobota'.split('_'),
        weekdaysShort: 'ned._pon._tor._sre._čet._pet._sob.'.split('_'),
        weekdaysMin: 'ne_po_to_sr_če_pe_so'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'H:mm',
            LTS: 'H:mm:ss',
            L: 'DD. MM. YYYY',
            LL: 'D. MMMM YYYY',
            LLL: 'D. MMMM YYYY H:mm',
            LLLL: 'dddd, D. MMMM YYYY H:mm',
        },
        calendar: {
            sameDay: '[danes ob] LT',
            nextDay: '[jutri ob] LT',

            nextWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[v] [nedeljo] [ob] LT';
                    case 3:
                        return '[v] [sredo] [ob] LT';
                    case 6:
                        return '[v] [soboto] [ob] LT';
                    case 1:
                    case 2:
                    case 4:
                    case 5:
                        return '[v] dddd [ob] LT';
                }
            },
            lastDay: '[včeraj ob] LT',
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[prejšnjo] [nedeljo] [ob] LT';
                    case 3:
                        return '[prejšnjo] [sredo] [ob] LT';
                    case 6:
                        return '[prejšnjo] [soboto] [ob] LT';
                    case 1:
                    case 2:
                    case 4:
                    case 5:
                        return '[prejšnji] dddd [ob] LT';
                }
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: 'čez %s',
            past: 'pred %s',
            s: processRelativeTime,
            ss: processRelativeTime,
            m: processRelativeTime,
            mm: processRelativeTime,
            h: processRelativeTime,
            hh: processRelativeTime,
            d: processRelativeTime,
            dd: processRelativeTime,
            M: processRelativeTime,
            MM: processRelativeTime,
            y: processRelativeTime,
            yy: processRelativeTime,
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal: '%d.',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 7, // The week that contains Jan 7th is the first week of the year.
        },
    });

    return sl;

})));


/***/ }),

/***/ "../src/sentry/locale/sl/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/sl/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Uporabniško ime"],"Permissions":["Dovoljenja"],"Default (let Sentry decide)":["Privzeto (naj se Sentry odloči)"],"Info":["Informacija"],"Remove":["Odstrani"],"Priority":["Prednost"],"Last Seen":["Nazadnje videno"],"First Seen":["Prvič videno"],"Frequency":["Pogostnost"],"Score":["Rezultat"],"Name":["Ime"],"URL":["URL"],"Project":["Projekt"],"Active":["Aktivno"],"Unresolved":["Nerazrešeno"],"Resolved":["Razrešeno"],"error":["napaka"],"Events":["Dogodki"],"Users":["Uporabniki"],"name":["ime"],"user":["uporabnik"],"Page Not Found":["Stran ni bila najdena"],"The page you are looking for was not found.":["Stran, katero ste iskali, ni bila najdena."],"Cancel":["Prekliči"],"Submit":["Pošlji"],"Next":["Naslednji"],"Register":["Vpis"],"Save Changes":["Shrani spremembe"],"ID:":["ID:"],"Username:":["Uporabniško ime:"],"m":["m"],"never":["nikoli"],"1 day":["1 dan"],"Account":["Račun"],"Password":["Geslo"],"Email":["E-pošta"],"Teams":["Ekipe"],"Projects":["Projekti"],"Details":["Podrobnosti"],"Exception":["Izjema"],"Tags":["Oznake"],"Previous":["Predhodni"],"Confirm":["Potrdi"],"Version":["Različica"],"Change":["Spremeni"],"Device":["Naprava"],"Operating System":["Operacijski sistem"],"User":["Uporabnik"],"Language":["Jezik"],"Status":["Stanje"],"Actions":["Dejanja"],"Raw":["Neobdelan zapis"],"Additional Data":["Dodatni podatki"],"Event ID":["ID dogodka"],"Path":["Pot:"],"Environment":["Okolje"],"Filename":["Ime datoteke"],"Packages":["Paketi"],"Contribute":["Prispevaj"],"Link":["Povezava"],"Regression":["Nazadovanje"],"Create Team":["Ustvari ekipo"],"Email Address":["E-poštni naslov"],"Apply":["Uveljavi"],"Project Settings":["Nastavitve projekta"],"Project Details":["Podrobnosti projekta"],"Clear":["Počisti"],"Alerts":["Opozorilo"],"Stats":["Statistika"],"Settings":["Nastavitve"],"Members":["Člani"],"Admin":["Skrbnik"],"n/a":["n/a"],"Tag Details":["Podrobnosti oznake"],"Team Name":["Ime ekipe"],"Separate multiple entries with a newline.":["Ločite več vnosov z novo vrstico."],"General":["Splošno"],"Allowed Domains":["Dovoljene domene"],"Server":["Strežnik"],"Organizations":["Organizacije"],"Mail":["Pošta"],"Notifications":["Obvestila"],"Identities":["Identitete"],"Configuration":["Nastavitve"],"API Key":["Ključ API"],"Team":["Ekipa"],"Create a new account":["Ustvarite nov račun"],"Server Version":["Različica strežnika"],"Python Version":["Različica Pythona"],"Configuration File":["Nastavitvena datoteka"],"Uptime":["Čas delovanja"],"Environment not found (are you using the builtin Sentry webserver?).":["Okolje ni bilo najdeno (ali uporabljate vgrajeni spletni strežnik Sentry?)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Pošljite e-pošto na e-poštni naslov svojega računa za potrditev, da je vse pravilno nastavljeno."],"SMTP Settings":["Nastavitve SMTP"],"From Address":["Od naslova"],"Host":["Gostitelj"],"not set":["ni nastavljeno"],"No":["Ne"],"Yes":["Da"],"Test Settings":["Preizkusite nastavitve"],"Extensions":["Razširitve"],"Modules":["Moduli"],"Disable the account.":["Onemogoči račun."],"Permanently remove the user and their data.":["Trajno odstrani uporabnika in njegove podatke."],"Remove User":["Odstrani uporabnika"],"15 minutes":["15 minut"],"24 hours":["24 ur"],"Member":["Član"],"60 minutes":["60 minut"],"Login":["Prijava"],"All Events":["Vsi dogodki"],"Select a platform":["Izberite okolje"],"Create Organization":["Ustvari Organizacijo"],"Create a New Organization":["Ustvari novo organizacijo"],"Bookmark":["Zaznamek"],"Enabled":["Omogočeno"],"Overview":["Pregled"],"Trends":["Trendi"],"Search":["Iskanje"],"Project Name":["Naziv projekta"],"API Keys":["Ključi API"],"Revoke":["Prekliči"],"Dashboard":["Pregledna plošča"],"Pending Members":["Čakajoči člani"],"Team Details":["Podrobnosti ekipe"],"Add Member":["Dodaj člana"],"Add Project":["Dodaj projekt"],"Remove Team":["Odstrani ekipo"],"Hidden":["Skrito"],"Generate New Key":["Ustvari nov ključ"],"Client Configuration":["Nastavitev odjemalca"],"Remove Project":["Odstrani projekt"],"This project cannot be removed. It is used internally by the Sentry server.":["Tega projekta ni mogoče odstraniti. Strežnik Sentry ga uporablja."],"Event Settings":["Nastavitve dogodka"],"Client Security":["Varnost odjemalca"],"Enable Plugin":["Omogoči vstavek"],"Disable Plugin":["Onemogoči vstavek"],"Reset Configuration":["Ponastavi nastavitve"],"Create a New Team":["Ustvari novo ekipo"],"":{"domain":"sentry","plural_forms":"nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);","lang":"sl"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/sl.f4a476bc1ac155ccb8cc26d8b87d524a.js.map
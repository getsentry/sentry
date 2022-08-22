(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/sk"],{

/***/ "../node_modules/moment/locale/sk.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/sk.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Slovak [sk]
//! author : Martin Minka : https://github.com/k2s
//! based on work of petrbela : https://github.com/petrbela

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var months =
            'január_február_marec_apríl_máj_jún_júl_august_september_október_november_december'.split(
                '_'
            ),
        monthsShort = 'jan_feb_mar_apr_máj_jún_júl_aug_sep_okt_nov_dec'.split('_');
    function plural(n) {
        return n > 1 && n < 5;
    }
    function translate(number, withoutSuffix, key, isFuture) {
        var result = number + ' ';
        switch (key) {
            case 's': // a few seconds / in a few seconds / a few seconds ago
                return withoutSuffix || isFuture ? 'pár sekúnd' : 'pár sekundami';
            case 'ss': // 9 seconds / in 9 seconds / 9 seconds ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'sekundy' : 'sekúnd');
                } else {
                    return result + 'sekundami';
                }
            case 'm': // a minute / in a minute / a minute ago
                return withoutSuffix ? 'minúta' : isFuture ? 'minútu' : 'minútou';
            case 'mm': // 9 minutes / in 9 minutes / 9 minutes ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'minúty' : 'minút');
                } else {
                    return result + 'minútami';
                }
            case 'h': // an hour / in an hour / an hour ago
                return withoutSuffix ? 'hodina' : isFuture ? 'hodinu' : 'hodinou';
            case 'hh': // 9 hours / in 9 hours / 9 hours ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'hodiny' : 'hodín');
                } else {
                    return result + 'hodinami';
                }
            case 'd': // a day / in a day / a day ago
                return withoutSuffix || isFuture ? 'deň' : 'dňom';
            case 'dd': // 9 days / in 9 days / 9 days ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'dni' : 'dní');
                } else {
                    return result + 'dňami';
                }
            case 'M': // a month / in a month / a month ago
                return withoutSuffix || isFuture ? 'mesiac' : 'mesiacom';
            case 'MM': // 9 months / in 9 months / 9 months ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'mesiace' : 'mesiacov');
                } else {
                    return result + 'mesiacmi';
                }
            case 'y': // a year / in a year / a year ago
                return withoutSuffix || isFuture ? 'rok' : 'rokom';
            case 'yy': // 9 years / in 9 years / 9 years ago
                if (withoutSuffix || isFuture) {
                    return result + (plural(number) ? 'roky' : 'rokov');
                } else {
                    return result + 'rokmi';
                }
        }
    }

    var sk = moment.defineLocale('sk', {
        months: months,
        monthsShort: monthsShort,
        weekdays: 'nedeľa_pondelok_utorok_streda_štvrtok_piatok_sobota'.split('_'),
        weekdaysShort: 'ne_po_ut_st_št_pi_so'.split('_'),
        weekdaysMin: 'ne_po_ut_st_št_pi_so'.split('_'),
        longDateFormat: {
            LT: 'H:mm',
            LTS: 'H:mm:ss',
            L: 'DD.MM.YYYY',
            LL: 'D. MMMM YYYY',
            LLL: 'D. MMMM YYYY H:mm',
            LLLL: 'dddd D. MMMM YYYY H:mm',
        },
        calendar: {
            sameDay: '[dnes o] LT',
            nextDay: '[zajtra o] LT',
            nextWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[v nedeľu o] LT';
                    case 1:
                    case 2:
                        return '[v] dddd [o] LT';
                    case 3:
                        return '[v stredu o] LT';
                    case 4:
                        return '[vo štvrtok o] LT';
                    case 5:
                        return '[v piatok o] LT';
                    case 6:
                        return '[v sobotu o] LT';
                }
            },
            lastDay: '[včera o] LT',
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[minulú nedeľu o] LT';
                    case 1:
                    case 2:
                        return '[minulý] dddd [o] LT';
                    case 3:
                        return '[minulú stredu o] LT';
                    case 4:
                    case 5:
                        return '[minulý] dddd [o] LT';
                    case 6:
                        return '[minulú sobotu o] LT';
                }
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: 'za %s',
            past: 'pred %s',
            s: translate,
            ss: translate,
            m: translate,
            mm: translate,
            h: translate,
            hh: translate,
            d: translate,
            dd: translate,
            M: translate,
            MM: translate,
            y: translate,
            yy: translate,
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal: '%d.',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return sk;

})));


/***/ }),

/***/ "../src/sentry/locale/sk/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/sk/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Používateľské meno"],"Permissions":["Oprávnenia"],"Default (let Sentry decide)":["Predvolený (nechaj rozhodnúť Sentry)"],"Most recent call last":["Od najnovšieho volania"],"Most recent call first":["Od posledného volania"],"Remove":["Odstrániť"],"Continue":["Pokračuj"],"Priority":["Priorita"],"Last Seen":["Naposledy Videný"],"First Seen":["Prvýkrát Videný"],"Frequency":["Početnosť"],"Score":["Skóre"],"Name":["Meno"],"URL":["URL Adresa"],"Project":["Projekt"],"Active":["Aktívny"],"Unresolved":["Nevyriešené"],"Resolved":["Vyriešené"],"error":["chyba"],"Events":["Udalosti"],"Users":["Používatelia"],"user":["užívateľ"],"Page Not Found":["Stránka sa nenašla"],"The page you are looking for was not found.":["Stránka, ktorú hľadáte nebola nájdená."],"Cancel":["Zrušiť"],"Confirm Password":["Potvrdte heslo"],"Sign out":["Odhlásiť"],"Submit":["Potvrdiť"],"Next":["Nasledujúci"],"Register":["Registrácia"],"Save Changes":["Uložiť Zmeny"],"Method":["Metóda"],"Query":["Dopyt"],"ID:":["ID:"],"Username:":["Používateľské meno:"],"m":["m"],"never":["nikdy"],"1 day":["1 deň"],"Account":["Účet"],"Password":["Heslo"],"Email":["Email"],"Help":["Pomoc"],"Edit":["Upraviť"],"Are you sure you wish to delete this comment?":["Ste si istý, že chcete odstrániť tento komentár?"],"Teams":["Tímy"],"Invite Member":["Pozvať člena"],"Projects":["Projekty"],"Details":["Podrobnosti"],"Exception":["Výnimka"],"Tags":["Štítok"],"Release":["Vydať"],"Previous":["Predchádzajúci"],"Collapse":["Skryť"],"Confirm":["Potvrdiť"],"Created":["Vytvorené"],"Version":["Verzia"],"Sort by":["Zoradiť podľa"],"Change":["Zmeniť"],"Device":["Zariadenie"],"Operating System":["Operačný Systém"],"User":["Používateľ"],"Language":["Jazyk"],"Status":["Stav"],"Expand":["Zväčšiť"],"Delete":["Zmazať"],"Actions":["Akcie"],"Raw":["Nespracované"],"Additional Data":["Doplňujúce Údaje"],"Event ID":["ID Udalosti"],"Level":["Úroveň"],"most recent call first":["od posledného volania"],"most recent call last":["od najnovšieho volania"],"Path":["Cesta"],"Toggle Context":["Prepnúť Kontext"],"Message":["Správa"],"Cookies":["Cookies"],"Headers":["Hlavičky"],"Environment":["Prostredie"],"Body":["Telo"],"Filename":["Názov súboru"],"Packages":["Balíčky"],"API":["API"],"Docs":["Dokumenty"],"Contribute":["Prispievaj"],"Link":["Odkaz"],"Regression":["Návrat"],"Save":["Uložiť"],"Create Team":["Vytvoriť Tím"],"Back":["Späť"],"Skip this step":["Preskoč krok"],"Email Address":["Emailová Adresa"],"Apply":["Použi"],"All":["Všetky"],"Disable":["Vypnuté"],"Organization Settings":["Nastavenia organizácie"],"Project Settings":["Nastavenia Projektu"],"Project Details":["Podrobnosti Projektu"],"Clear":["Vyčistiť"],"Alerts":["Upozornenia"],"Stats":["Štatistiky"],"Settings":["Nastavenia"],"Members":["Členovia"],"Admin":["Administrátor"],"Exception Type":["Druh výnimky"],"n/a":["nedostupné"],"Tag Details":["Detaily Tagu"],"Team Name":["Názov Tímu"],"Last 24 hours":["Posledných 24 hodín"],"Separate multiple entries with a newline.":["Viaceré záznamy oddeľte novým riadkom."],"General":["Všeobecné"],"Allowed Domains":["Povolené Domény"],"Server":["Server"],"Organizations":["Organizácie"],"Queue":["Rad"],"Mail":["Pošta"],"Notifications":["Oznámenia"],"Identities":["Identity"],"Configuration":["Konfigurácia"],"API Key":["API Kľúč"],"Audit Log":["Audit log"],"Rate Limits":["Miery Obmedzenia"],"Team":["Tím"],"Integrations":["Integrácie"],"Create a new account":["Vytvoriť nový účet"],"Server Version":["Verzia Servera"],"Python Version":["Verzia Pythonu"],"Configuration File":["Konfiguračný Súbor"],"Uptime":["Doba prevádzky"],"Environment not found (are you using the builtin Sentry webserver?).":["Prostredie sa nenašlo (používate vstavaný Sentry webserver?)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Odoslať email na emailovú adresu vášho účtu pre potvrdenie správnosti konfigurácie."],"SMTP Settings":["SMTP Nastavenia"],"From Address":["Adresa Od"],"Host":["Host"],"not set":["nenastavený"],"No":["Nie"],"Yes":["Áno"],"Test Settings":["Testovacie Nastavenia"],"Extensions":["Rozšírenia"],"Modules":["Moduly"],"Disable the account.":["Zakázať účet."],"Permanently remove the user and their data.":["Natrvalo odstrániť používateľa a jeho dáta."],"Remove User":["Odstrániť Používateľa"],"Designates whether this user can perform administrative functions.":["Určuje, či používateľ môže vykonávať administratívne funkcie."],"Superuser":["Superpoužívateľ"],"15 minutes":["15 minút"],"24 hours":["24 hodín"],"Save Rule":["Uložiť pravidlo"],"Member":["Člen"],"60 minutes":["60 minút"],"Edit Rule":["Uprav pravidlo"],"Login":["Prihlásiť"],"All Events":["Všetky Udalosti"],"This action cannot be undone.":["Túto akciu nie je možné vrátiť späť."],"Tag":["Tag"],"Enable":["Zapnuté"],"Select a platform":["Vyberte platformu"],"Create Organization":["Vytvor organizáciu"],"Create a New Organization":["Vytvoriť novú organizáciu"],"Organization Name":["Meno orgranizácie"],"Bookmark":["Záložka"],"Enabled":["Povolené"],"Event Details":["Podrobnosti Udalosti"],"Overview":["Prehľad"],"Trends":["Trendy"],"Create a team":["Vytvor tým"],"DSN":["DSN"],"Restore":["Obnoviť"],"Search":["Vyhľadávanie"],"Project Name":["Názov Projektu"],"Integration":["Integrácia"],"API Keys":["API Kľúče"],"Edit API Key":["Zmeniť API kľúč"],"Key":["Kľúč"],"Revoke":["Zrušiť"],"Dashboard":["Dashboard"],"Remove Organization":["Odstrániť organizáciu"],"Member Settings":["Nastavenia člena"],"Resend Invite":["Poslať pozvánku znovu"],"Pending Members":["Nevybavení Členovia"],"Public Key":["Verejný kľúč"],"Team Details":["Podrobnosti Tímu"],"Add Member":["Pridať Člena"],"Add Project":["Pridať Projekt"],"Remove Team":["Odstrániť Tím"],"Hidden":["Skrytý"],"Generate New Key":["Generovať Nový Kľúč"],"Secret Key":["Tajný kľúč"],"Project ID":["ID projektu"],"Client Configuration":["Konfigurácia Klienta"],"Remove Project":["Odstrániť Projekt"],"This project cannot be removed. It is used internally by the Sentry server.":["Tento projekt nemôže byť odstránený. Je interne používaný Sentry serverom."],"Event Settings":["Nastavenia Udalosti"],"Client Security":["Bezpečnosť Klienta"],"Enable Plugin":["Povoliť Plugin"],"Disable Plugin":["Deaktivovať Plugin"],"Reset Configuration":["Vynulovať Konfiguráciu"],"Create a New Team":["Vytvoriť Nový Tím"],"":{"domain":"sentry","plural_forms":"nplurals=4; plural=(n % 1 == 0 && n == 1 ? 0 : n % 1 == 0 && n >= 2 && n <= 4 ? 1 : n % 1 != 0 ? 2: 3);","lang":"sk"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/sk.13cb8ba774033b6e3da54df14dbd1885.js.map
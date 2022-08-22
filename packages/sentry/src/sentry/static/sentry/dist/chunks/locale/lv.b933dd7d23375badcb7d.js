(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/lv"],{

/***/ "../node_modules/moment/locale/lv.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/lv.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Latvian [lv]
//! author : Kristaps Karlsons : https://github.com/skakri
//! author : Jānis Elmeris : https://github.com/JanisE

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var units = {
        ss: 'sekundes_sekundēm_sekunde_sekundes'.split('_'),
        m: 'minūtes_minūtēm_minūte_minūtes'.split('_'),
        mm: 'minūtes_minūtēm_minūte_minūtes'.split('_'),
        h: 'stundas_stundām_stunda_stundas'.split('_'),
        hh: 'stundas_stundām_stunda_stundas'.split('_'),
        d: 'dienas_dienām_diena_dienas'.split('_'),
        dd: 'dienas_dienām_diena_dienas'.split('_'),
        M: 'mēneša_mēnešiem_mēnesis_mēneši'.split('_'),
        MM: 'mēneša_mēnešiem_mēnesis_mēneši'.split('_'),
        y: 'gada_gadiem_gads_gadi'.split('_'),
        yy: 'gada_gadiem_gads_gadi'.split('_'),
    };
    /**
     * @param withoutSuffix boolean true = a length of time; false = before/after a period of time.
     */
    function format(forms, number, withoutSuffix) {
        if (withoutSuffix) {
            // E.g. "21 minūte", "3 minūtes".
            return number % 10 === 1 && number % 100 !== 11 ? forms[2] : forms[3];
        } else {
            // E.g. "21 minūtes" as in "pēc 21 minūtes".
            // E.g. "3 minūtēm" as in "pēc 3 minūtēm".
            return number % 10 === 1 && number % 100 !== 11 ? forms[0] : forms[1];
        }
    }
    function relativeTimeWithPlural(number, withoutSuffix, key) {
        return number + ' ' + format(units[key], number, withoutSuffix);
    }
    function relativeTimeWithSingular(number, withoutSuffix, key) {
        return format(units[key], number, withoutSuffix);
    }
    function relativeSeconds(number, withoutSuffix) {
        return withoutSuffix ? 'dažas sekundes' : 'dažām sekundēm';
    }

    var lv = moment.defineLocale('lv', {
        months: 'janvāris_februāris_marts_aprīlis_maijs_jūnijs_jūlijs_augusts_septembris_oktobris_novembris_decembris'.split(
            '_'
        ),
        monthsShort: 'jan_feb_mar_apr_mai_jūn_jūl_aug_sep_okt_nov_dec'.split('_'),
        weekdays:
            'svētdiena_pirmdiena_otrdiena_trešdiena_ceturtdiena_piektdiena_sestdiena'.split(
                '_'
            ),
        weekdaysShort: 'Sv_P_O_T_C_Pk_S'.split('_'),
        weekdaysMin: 'Sv_P_O_T_C_Pk_S'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD.MM.YYYY.',
            LL: 'YYYY. [gada] D. MMMM',
            LLL: 'YYYY. [gada] D. MMMM, HH:mm',
            LLLL: 'YYYY. [gada] D. MMMM, dddd, HH:mm',
        },
        calendar: {
            sameDay: '[Šodien pulksten] LT',
            nextDay: '[Rīt pulksten] LT',
            nextWeek: 'dddd [pulksten] LT',
            lastDay: '[Vakar pulksten] LT',
            lastWeek: '[Pagājušā] dddd [pulksten] LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: 'pēc %s',
            past: 'pirms %s',
            s: relativeSeconds,
            ss: relativeTimeWithPlural,
            m: relativeTimeWithSingular,
            mm: relativeTimeWithPlural,
            h: relativeTimeWithSingular,
            hh: relativeTimeWithPlural,
            d: relativeTimeWithSingular,
            dd: relativeTimeWithPlural,
            M: relativeTimeWithSingular,
            MM: relativeTimeWithPlural,
            y: relativeTimeWithSingular,
            yy: relativeTimeWithPlural,
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal: '%d.',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return lv;

})));


/***/ }),

/***/ "../src/sentry/locale/lv/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/lv/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Lietotājvārds"],"Permissions":["Tiesības"],"Default (let Sentry decide)":["Pēc noklusējuma (atļaut Sentry izlemt)"],"Most recent call last":["Jaunākais pieprasījums beigās"],"Most recent call first":["Jaunākais pieprasījums sākumā"],"Info":["Informācija"],"Remove":["Dzēst"],"Configure":["Konfigurēt"],"Continue":["Turpināt"],"Priority":["Prioritāte"],"Last Seen":["Pēdējo reizi redzēts"],"First Seen":["Pirmo reizi redzēts"],"Frequency":["Biežums"],"Score":["Rezultāts"],"Name":["Vārds"],"URL":["Saite"],"Project":["Projekts"],"Active":["Aktīvs"],"Unresolved":["Neatrisināts"],"Resolved":["Atrisināts"],"Ignored":["Ignorēts"],"error":["kļūda"],"Events":["Notikumi"],"Users":["Lietotāji"],"user":["lietotājs"],"Page Not Found":["Lapa Nav Atrasta"],"The page you are looking for was not found.":["Lapa, kuru meklējāt, nav atrasta."],"You may wish to try the following:":["Iespējams, vēlaties pamēģināt sekojošo:"],"Cancel":["Atsaukt"],"Confirm Password":["Apstipriniet Paroli"],"Lost your password?":["Aizmirsāt paroli?"],"Sign out":["Izrakstīties"],"Submit":["Iesniegt"],"Next":["Nākošais"],"Upgrade":["Atjaunināt"],"Sign in to continue":["Autorizējieties, lai turpinātu"],"Register":["Reģistrēties"],"Privacy Policy":["Privātuma Politika"],"Organization ID":["Organizācijas ID"],"Approve":["Apstiprināt"],"Deny":["Aizliegt"],"Request to Join":["Pieprasīt Pievienoties"],"Save Changes":["Saglabāt izmaiņas"],"Method":["Metode"],"Query":["Pieprasījums"],"Fragment":["Fragments"],"ID:":["ID:"],"Username:":["Lietotāja vārds:"],"Create Issue":["Izveidot Laidienu"],"Link Issue":["Piesaisīt Laidienu"],"Restore Organization":["Atjaunot Organizāciju"],"Deletion Scheduled":["Dzēšana Ieplānota"],"m":["m"],"never":["nekad"],"1 day":["1 diena"],"Account":["Konts"],"username or email":["lietotājvārds vai parole"],"Password":["Parole"],"password":["parole"],"Email":["Epasts"],"Close":["Aizvērt"],"Resolve":["Atrisināt"],"Teams":["Komandas"],"Projects":["Projekti"],"Issues":["Problēmas"],"Details":["Detaļas"],"Exception":["Izņēmums"],"Tags":["Birkas"],"Previous":["Iepriekšējais"],"Confirm":["Apstiprināt"],"Version":["Versija"],"Change":["Izmainīt"],"Operating System":["Operētājsistēma"],"User":["Lietotājs"],"Language":["Valoda"],"Status":["Statuss"],"Actions":["Darbības"],"Raw":["Jēls"],"Additional Data":["Papildus dati"],"Event ID":["Notikuma ID"],"most recent call first":["vissenākais pieprasījums sākumā"],"most recent call last":["vissenākais pieprasījums beigās"],"Path":["Ceļš"],"Toggle Context":["Sakļaut kontekstu"],"Environment":["Vide"],"Filename":["Fails"],"Packages":["Pakotnes"],"API":["API"],"Docs":["Dokumentācija"],"Contribute":["Veltīt"],"Migrate to SaaS":["Migrēt uz SaaS"],"Link":["Saite"],"Regression":["Regresija"],"Ownership Rules":["Piederības Noteikumi"],"Create Team":["Izveidot komandu"],"Email Address":["Epasta adreses"],"Apply":["Piemērot"],"Project Settings":["Projekta uzstādījumi"],"Project Details":["Projekta dati"],"Clear":["Notīrīt"],"Alerts":["Trauksmes"],"Stats":["Statistika"],"Settings":["Uzstādījumi"],"Members":["Biedri"],"Admin":["Administrators"],"n/a":["nav pieejams"],"Tag Details":["Birkas raksturlielumi"],"Team Name":["Komandas nosaukums"],"Never":["Nekad"],"Use a 24-hour clock":["Izmantot 24-stundu laiku"],"Separate multiple entries with a newline.":["Atdaliet vairākus ierakstus ar pārnesi jaunā rindā."],"General":["Kopumā"],"Allowed Domains":["Atļautie domēni"],"Mail":["Pasts"],"Notifications":["Paziņojumi"],"Identities":["Identitātes"],"Configuration":["Konfigurācija"],"API Key":["API atslēga"],"Team":["Komanda"],"Integrations":["Integrācijas"],"Create a new account":["Izveidot jaunu kontu"],"Server Version":["Servera versija"],"Python Version":["Python versija"],"Configuration File":["Konfigurācijas fails"],"Uptime":["Darbspējas laiks"],"Environment not found (are you using the builtin Sentry webserver?).":["Vide nav atrasta (vai jūs lietojat iegulto Sentry tīmekļa serverī?)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Nosūtīt epastu uz konta epasta adresi lai apstiprinātu, ka uzstādījumi ir pareizi."],"SMTP Settings":["SMTP uzstādījumi"],"Host":["Hosts"],"not set":["nav uzstādīts"],"No":["Nē"],"Yes":["Jā"],"Test Settings":["Testa uzstādījumi"],"Extensions":["Paplašinājumi"],"Modules":["Moduļi"],"Disable the account.":["Bloķēt kontu."],"Permanently remove the user and their data.":["Neatgriezeniski dzēst lietotāju un viņa datus"],"Remove User":["Noņemt lietotāju"],"Designates whether this user can perform administrative functions.":["Nosaka vai šis lietotājs var veikt administratora funkcijas."],"15 minutes":["15 minūtes"],"24 hours":["24 stundas"],"60 minutes":["60 minūtes"],"Login":["Pieslēgties"],"All Events":["Visi notikumi"],"Select a platform":["Izvēlēties platformu"],"Bookmark":["Grāmatzīme"],"Enabled":["Iespējots"],"Overview":["Pārskats"],"Trends":["Tendences"],"Search":["Meklēt"],"Project Name":["Projekta nosaukums"],"Integration":["Integrācija"],"API Keys":["API atslēgas"],"Revoke":["Atsaukt"],"Dashboard":["Infopanelis"],"Saving...":["Saglabā..."],"Pending Members":["Neapstiprinātie dalībnieki"],"Team Details":["Komandas īpašības"],"Add Member":["Pievienot dalībnieku"],"Add Project":["Pievienot projektu"],"Remove Team":["Dzēst komandu"],"Hidden":["Paslēpts"],"Generate New Key":["Generēt jaunu atslēgu"],"Problem":["Problēma"],"Client Configuration":["Klienta uzstādijumi"],"Remove Project":["Izdzēst projektu"],"This project cannot be removed. It is used internally by the Sentry server.":["Projekts nevar tikt izdzēsts. To izmanto Sentry iekšējām vajadzībām."],"Event Settings":["Notikuma uzstādījumi"],"Client Security":["Klienta drošība"],"Enable Plugin":["Iespējot spraudni"],"Disable Plugin":["Atspējot spraudni"],"Reset Configuration":["Atiestatīt uzstādījumus"],"Create a New Team":["Izveidot jaunu komandu"],"":{"domain":"sentry","plural_forms":"nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n != 0 ? 1 : 2);","lang":"lv"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/lv.1fbd0efb1dac75e44f6fbc389ec5d3db.js.map
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/et"],{

/***/ "../node_modules/moment/locale/et.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/et.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Estonian [et]
//! author : Henry Kehlmann : https://github.com/madhenry
//! improvements : Illimar Tambek : https://github.com/ragulka

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    function processRelativeTime(number, withoutSuffix, key, isFuture) {
        var format = {
            s: ['mõne sekundi', 'mõni sekund', 'paar sekundit'],
            ss: [number + 'sekundi', number + 'sekundit'],
            m: ['ühe minuti', 'üks minut'],
            mm: [number + ' minuti', number + ' minutit'],
            h: ['ühe tunni', 'tund aega', 'üks tund'],
            hh: [number + ' tunni', number + ' tundi'],
            d: ['ühe päeva', 'üks päev'],
            M: ['kuu aja', 'kuu aega', 'üks kuu'],
            MM: [number + ' kuu', number + ' kuud'],
            y: ['ühe aasta', 'aasta', 'üks aasta'],
            yy: [number + ' aasta', number + ' aastat'],
        };
        if (withoutSuffix) {
            return format[key][2] ? format[key][2] : format[key][1];
        }
        return isFuture ? format[key][0] : format[key][1];
    }

    var et = moment.defineLocale('et', {
        months: 'jaanuar_veebruar_märts_aprill_mai_juuni_juuli_august_september_oktoober_november_detsember'.split(
            '_'
        ),
        monthsShort:
            'jaan_veebr_märts_apr_mai_juuni_juuli_aug_sept_okt_nov_dets'.split('_'),
        weekdays:
            'pühapäev_esmaspäev_teisipäev_kolmapäev_neljapäev_reede_laupäev'.split(
                '_'
            ),
        weekdaysShort: 'P_E_T_K_N_R_L'.split('_'),
        weekdaysMin: 'P_E_T_K_N_R_L'.split('_'),
        longDateFormat: {
            LT: 'H:mm',
            LTS: 'H:mm:ss',
            L: 'DD.MM.YYYY',
            LL: 'D. MMMM YYYY',
            LLL: 'D. MMMM YYYY H:mm',
            LLLL: 'dddd, D. MMMM YYYY H:mm',
        },
        calendar: {
            sameDay: '[Täna,] LT',
            nextDay: '[Homme,] LT',
            nextWeek: '[Järgmine] dddd LT',
            lastDay: '[Eile,] LT',
            lastWeek: '[Eelmine] dddd LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: '%s pärast',
            past: '%s tagasi',
            s: processRelativeTime,
            ss: processRelativeTime,
            m: processRelativeTime,
            mm: processRelativeTime,
            h: processRelativeTime,
            hh: processRelativeTime,
            d: processRelativeTime,
            dd: '%d päeva',
            M: processRelativeTime,
            MM: processRelativeTime,
            y: processRelativeTime,
            yy: processRelativeTime,
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal: '%d.',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return et;

})));


/***/ }),

/***/ "../src/sentry/locale/et/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/et/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Kasutajanimi"],"Permissions":["Õigused"],"Remove":["Eemalda"],"Continue":["Jätka"],"Priority":["Tähtsus"],"Last Seen":["Viimati nähtud"],"First Seen":["Esimesena nähtud"],"Frequency":["Sagedus"],"Score":["Punktid"],"Name":["Nimi"],"URL":["URL"],"Project":["Projekt"],"Active":["Aktiivne"],"Unresolved":["Lahendamata"],"Resolved":["Lahendatud"],"error":["viga"],"Events":["Sündmused"],"Users":["Kasutajad"],"name":["nimi"],"user":["kasutaja"],"Page Not Found":["Lehekülge ei leitud"],"You may wish to try the following:":["Sa võid proovida järgnevat:"],"Cancel":["Loobu"],"Confirm Password":["Kinnita parooli"],"Lost your password?":["Kaotasid oma parooli?"],"Sign out":["Logi välja"],"Submit":["Saada"],"Next":["Järgmine"],"Register":["Registreeru"],"Privacy Policy":["Privaatsus"],"Save Changes":["Salvesta muudatused"],"Method":["Meetod"],"Query":["Päring"],"Fragment":["Fragment"],"ID:":["ID:"],"Username:":["Kasutajanimi:"],"Create Issue":["Loo probleem"],"m":["m"],"never":["mitte kunagi"],"1 day":["1 päev"],"Account":["Konto"],"username or email":["kasutajanimi või e-post"],"Password":["Parool"],"password":["parool"],"Email":["E-post"],"Close":["Sulge"],"Default Role":["Vaikimisi roll"],"Help":["Abiinfo"],"Resolve":["Lahenda"],"Edit":["Muuda"],"Are you sure you wish to delete this comment?":["Oled sa kindel, et soovid seda kommentaari kustutada?"],"Save Comment":["Salvesta kommentaar"],"Post Comment":["Postita kommentaar"],"Write":["Kirjuta"],"Preview":["Eelvaade"],"Teams":["Meeskonnad"],"Invite Member":["Kutsu liiget"],"Projects":["Projektid"],"Issues":["Probleemid"],"Releases":["Väljalasked"],"Details":["Üksikasjad"],"Exception":["Erand"],"Tags":["Sildid"],"Release":["Väljalase"],"Previous":["Eelmine"],"Collapse":["Sulge"],"Confirm":["Kinnita"],"Date":["Kuupäev"],"Created":["Loodud"],"Version":["Versioon"],"Sort by":["Sorteeri"],"Change":["Muuda"],"Waiting for events…":["Sündmuste ootamine.."],"Installation Instructions":["Paigaldamise juhendid"],"Setup":["Seaded"],"Retry":["Proovi uuesti"],"ID":["ID"],"Operating System":["Operatsioonisüsteem"],"User":["Kasutaja"],"Language":["Keel"],"Status":["Staatus"],"Expand":["Laienda"],"Hide":["Peida"],"Show":["Näita"],"Delete":["Kustuta"],"Actions":["Tegevused"],"Show more":["Näita rohkem"],"Additional Data":["Lisainfo"],"Warning":["Hoiatus"],"Level":["Tase"],"System":["Süsteem"],"Default":["Vaikeväärtus"],"Full":["Täielik"],"App Only":["Ainult rakendus"],"at line":["real"],"Message":["Sõnum"],"Cookies":["Küpsised"],"Headers":["Päised"],"Environment":["Keskkond"],"Body":["Sisu"],"Template":["Kujundus"],"Label":["Silt"],"Other":["Muud"],"Packages":["Pakid"],"API":["API"],"Docs":["Dokumentatsioon"],"Contribute":["Toeta"],"Link":["Link"],"First seen":["Esimesena nähtud"],"Last seen":["Viimasena nähtud"],"Last 24 Hours":["Viimased 24 tundi"],"Last 30 Days":["Viimased 30 päeva"],"View more":["Vaata lisa"],"Nothing to show here, move along.":["Siin pole midagi vaadata, liigu edasi."],"Save":["Salvesta"],"Create Team":["Loo meeskond"],"Role":["Roll"],"Email Address":["E-posti aadressid"],"Oldest":["Vanimad"],"Older":["Vanem"],"Newer":["Uuem"],"Newest":["Uusim"],"Apply":["Rakenda"],"Filter projects":["Filtreeri projekte"],"All":["Kõik"],"Disable":["Lülita välja"],"Join Team":["Liitu meeskonnaga"],"Event":["Sündmus"],"Organization Settings":["Organisatsiooni seaded"],"Project Settings":["Projekti seaded"],"Project Details":["Projekti üksikasjad"],"Clear":["Tühjenda"],"Alerts":["Hoiatused"],"Stats":["Statistika"],"Settings":["Seaded"],"Members":["Liikmed"],"Admin":["Admin"],"n/a":["pole lubatud"],"Team Name":["Meeskonna nimi"],"%(time)s old":["%(time)s vana"],"New Issues":["Uued probleemid"],"Last 24 hours":["Viimased 24 tundi"],"Unknown error. Please try again.":["Tundmatu tõrge. Palun proovi uuesti."],"Use a 24-hour clock":["Kasuta 24-tunnist kella"],"Separate multiple entries with a newline.":["Eralda erinevad sissekanded reavahetusega"],"General":["Üldine"],"Enhanced Privacy":["Täiustatud privaatsus"],"Allowed Domains":["Lubatud domeenid"],"Popular":["Populaarne"],"Organizations":["Organisatsioonid"],"Queue":["Järjekord"],"Mail":["Meil"],"Organization":["Organisatsioon"],"Notifications":["Teavitused"],"Identities":["Identiteedid"],"Create New Token":["Loo uus kontrollkood"],"Applications":["Rakendused"],"Close Account":["Sulge konto"],"Release Tracking":["Väljalaske jälgimine"],"Client Keys":["Kliendi võti"],"Configuration":["Seadistamine"],"API Key":["API võti"],"Team":["Meeskond"],"Integrations":["Integreerimised"],"Unable to delete events. Please try again.":["Sündmuse kustutamine ebaõnnestus. Palun proovi uuesti."],"Unable to merge events. Please try again.":["Sündmuste kustutamine ebaõnnestus. Palun proovi uuesti."],"The selected events have been scheduled for merge.":["Valitud sündmused on kavandatud liitmiseks."],"Unable to update events. Please try again.":["Sündmuse uuendamine ebaõnnestus. Palun proovi uuesti."],"Create a new account":["Loo uus konto"],"Server Version":["Serveri versioon"],"Python Version":["Python versioon"],"Configuration File":["Seadistusfail"],"SMTP Settings":["SMTP seaded"],"From Address":["Aadressilt"],"Host":["Host"],"not set":["pole määratud"],"No":["Ei"],"Yes":["Jah"],"Test Settings":["Testi seadeid"],"Accepted":["Aktsepteeritud"],"Extensions":["Laiendus"],"Modules":["Moodulid"],"Disable the account.":["Lülita see konto välja."],"Permanently remove the user and their data.":["Eemalda kasutaja ja nende andmed jäädavalt."],"Remove User":["Eemalda kasutaja"],"Superuser":["Superkasutaja"],"Welcome to Sentry":["Teretulemast Sentryt kasutama"],"Admin Email":["Admini e-post"],"15 minutes":["15 minutit"],"30 minutes":["30 minutit"],"1 hour":["1 tund"],"2 hours":["2 tundi"],"24 hours":["24 tundi"],"Save Rule":["Salvesta reeglid"],"Member":["Liige"],"60 minutes":["60 minutit"],"1 week":["1 nädal"],"My Rule Name":["Minu reegli nimi"],"all":["kõik"],"any":["ni"],"none":["mitte ükski"],"Apply Changes":["Rakenda muudatused"],"History":["Ajalugu"],"Login":["Logi sisse"],"All Events":["Kõik sündmused"],"Select a project":["Vali projekt"],"Merge":["Liida"],"Add to Bookmarks":["Lisa järjehoidjatesse"],"Remove from Bookmarks":["Eemalda järjehoidjatest"],"Set status to: Unresolved":["Määra staatuseks: Lahendamata"],"Graph:":["Graafik:"],"24h":["24h"],"This action cannot be undone.":["Seda tegevust ei saa tühistada."],"Save Current Search":["Salvesta praegune otsing"],"Saved Searches":["Salvestatud otsingud"],"Custom Search":["Kohandatud otsing"],"Tag":["Silt"],"Text":["Tekst"],"Enable":["Lülita sisse"],"Select a platform":["Vali partform"],"The organization you were looking for was not found.":["Organisatsiooni, mida sa otsid ei leitud."],"Loading data for your organization.":["Sinu organisatsiooni andmete laadimine."],"Create Organization":["Loo organisatsioon"],"Create a New Organization":["Loo uus organisatsioon"],"Organization Name":["Organisatsiooni nimi"],"Error sharing":["Vea jagamine"],"Bookmark":["Järjehoidja"],"[author] ignored this issue until it happens [count] time(s) in [duration]":["[author] ignoreeris seda probleemi, kuni seda tul iette [count] kord(a) [duration] jooksul"],"[author] ignored this issue until it happens [count] time(s)":["[author] ignoreeris seda probleemi, kuni seda tul iette [count] kord(a)"],"The issue you were looking for was not found.":["Probleemi, mida sa otsid pole olemas."],"Compare":["Võrdle"],"Expand All":["Laienda kõiki"],"Collapse All":["Sulge kõik"],"More Details":["Lisainfo"],"Affected Users":["Mõjutatud kasutajad"],"Issue #":["Probleemi nr"],"Similar Issues":["Sarnased vead"],"Enabled":["Sisse lülitatud"],"Total":["Kokku"],"Event Details":["Sündmuse üksikasjad"],"Overview":["Ülevaade"],"Trends":["Trendid"],"Full Documentation":["Täielik dokumentatsioon"],"Configure your application":["Seadista oma rakendus"],"DSN":["DSN"],"Restore":["Taasta"],"All Issues":["Kõik probleemid"],"First Event":["Esimene sündmus"],"Last Event":["Viimane sündmus"],"Search":["Otsi"],"Project Name":["Projekti nimi"],"14d":["14p"],"Create New Application":["Loo uus rakendus"],"API Keys":["API võtmed"],"Edit API Key":["Muuda API võtit"],"Key":["Võti"],"Revoke":["Lükka tagasi"],"Dashboard":["Töölaud"],"Remove Organization":["Eemalda organisatsioon"],"Member Settings":["Liikme seaded"],"Basics":["Peamine"],"Added":["Lisatud"],"Resend Invite":["Saada kutse uuesti"],"Pending Members":["Ootel olevad liikmed"],"Public Key":["Avalik võti"],"Leave Team":["Lahku meeskonnast"],"Your Teams":["Sinu meeskonnad"],"Team Details":["Meeskonna üksikasjad"],"Add Member":["Lisa liige"],"Remove Team":["Eemalda meeskond"],"Client Keys (DSN)":["Kliendi võtmed (DSN)"],"Generate New Key":["Loo uus võti"],"Secret Key":["alajane võti"],"Project ID":["Projekti ID"],"Client Configuration":["Kliendi seadistamine"],"Remove Project":["Eemalda projekt"],"You do not have the required permission to remove this project.":["Sul pole selle projekti eemaldamiseks vajalikke õiguseid."],"Removing this project is permanent and cannot be undone!":["Selle projekti jäädav on püsiv ja seda ei saa tühistada!"],"Event Settings":["Sündmuse seaded"],"Client Security":["Kliendi turvalisus"],"Enable Plugin":["Lülita plugin sisse"],"Disable Plugin":["Lülita plugin välja"],"Reset Configuration":["Taasta plugina algseaded"],"Instructions":["Juhendid"],"Create a New Team":["Loo uus meeskond"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"et"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/et.cd0740e6f0976ccdff167ae3b1257f8b.js.map
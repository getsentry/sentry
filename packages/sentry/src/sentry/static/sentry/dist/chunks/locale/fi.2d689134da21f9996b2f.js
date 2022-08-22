(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/fi"],{

/***/ "../node_modules/moment/locale/fi.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/fi.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Finnish [fi]
//! author : Tarmo Aidantausta : https://github.com/bleadof

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var numbersPast =
            'nolla yksi kaksi kolme neljä viisi kuusi seitsemän kahdeksan yhdeksän'.split(
                ' '
            ),
        numbersFuture = [
            'nolla',
            'yhden',
            'kahden',
            'kolmen',
            'neljän',
            'viiden',
            'kuuden',
            numbersPast[7],
            numbersPast[8],
            numbersPast[9],
        ];
    function translate(number, withoutSuffix, key, isFuture) {
        var result = '';
        switch (key) {
            case 's':
                return isFuture ? 'muutaman sekunnin' : 'muutama sekunti';
            case 'ss':
                result = isFuture ? 'sekunnin' : 'sekuntia';
                break;
            case 'm':
                return isFuture ? 'minuutin' : 'minuutti';
            case 'mm':
                result = isFuture ? 'minuutin' : 'minuuttia';
                break;
            case 'h':
                return isFuture ? 'tunnin' : 'tunti';
            case 'hh':
                result = isFuture ? 'tunnin' : 'tuntia';
                break;
            case 'd':
                return isFuture ? 'päivän' : 'päivä';
            case 'dd':
                result = isFuture ? 'päivän' : 'päivää';
                break;
            case 'M':
                return isFuture ? 'kuukauden' : 'kuukausi';
            case 'MM':
                result = isFuture ? 'kuukauden' : 'kuukautta';
                break;
            case 'y':
                return isFuture ? 'vuoden' : 'vuosi';
            case 'yy':
                result = isFuture ? 'vuoden' : 'vuotta';
                break;
        }
        result = verbalNumber(number, isFuture) + ' ' + result;
        return result;
    }
    function verbalNumber(number, isFuture) {
        return number < 10
            ? isFuture
                ? numbersFuture[number]
                : numbersPast[number]
            : number;
    }

    var fi = moment.defineLocale('fi', {
        months: 'tammikuu_helmikuu_maaliskuu_huhtikuu_toukokuu_kesäkuu_heinäkuu_elokuu_syyskuu_lokakuu_marraskuu_joulukuu'.split(
            '_'
        ),
        monthsShort:
            'tammi_helmi_maalis_huhti_touko_kesä_heinä_elo_syys_loka_marras_joulu'.split(
                '_'
            ),
        weekdays:
            'sunnuntai_maanantai_tiistai_keskiviikko_torstai_perjantai_lauantai'.split(
                '_'
            ),
        weekdaysShort: 'su_ma_ti_ke_to_pe_la'.split('_'),
        weekdaysMin: 'su_ma_ti_ke_to_pe_la'.split('_'),
        longDateFormat: {
            LT: 'HH.mm',
            LTS: 'HH.mm.ss',
            L: 'DD.MM.YYYY',
            LL: 'Do MMMM[ta] YYYY',
            LLL: 'Do MMMM[ta] YYYY, [klo] HH.mm',
            LLLL: 'dddd, Do MMMM[ta] YYYY, [klo] HH.mm',
            l: 'D.M.YYYY',
            ll: 'Do MMM YYYY',
            lll: 'Do MMM YYYY, [klo] HH.mm',
            llll: 'ddd, Do MMM YYYY, [klo] HH.mm',
        },
        calendar: {
            sameDay: '[tänään] [klo] LT',
            nextDay: '[huomenna] [klo] LT',
            nextWeek: 'dddd [klo] LT',
            lastDay: '[eilen] [klo] LT',
            lastWeek: '[viime] dddd[na] [klo] LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: '%s päästä',
            past: '%s sitten',
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

    return fi;

})));


/***/ }),

/***/ "../src/sentry/locale/fi/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/fi/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Käyttäjänimi"],"Permissions":["Oikeudet"],"Default (let Sentry decide)":["Oletus (Sentry päättää)"],"Most recent call last":["Viimeisin kutsu viimeisenä"],"Most recent call first":["Viimeisin kutsu ensimmäisenä"],"Remove":["Poista"],"Continue":["Jatka"],"Priority":["Prioriteetti"],"Last Seen":["Viimeinen havainto"],"First Seen":["Ensimmäinen havainto"],"Frequency":["Taajuus"],"Score":["Pisteet"],"Name":["Nimi"],"Project":["Projekti"],"Active":["Aktiivinen"],"Unresolved":["Ratkaisematon"],"Resolved":["Ratkaistu"],"error":["virhe"],"Events":["Tapahtumat"],"Users":["Käyttäjät"],"user":["käyttäjä"],"Page Not Found":["Sivua ei löydy"],"The page you are looking for was not found.":["Etsimääsi sivua ei löytynyt."],"Cancel":["Peruuta"],"Confirm Password":["Vahvista Salasana"],"Submit":["Lähetä"],"Next":["Seuraava"],"Register":["Rekisteröidy"],"Save Changes":["Tallenna muutokset"],"Method":["Metodi"],"ID:":["ID:"],"Username:":["Käyttäjänimi:"],"never":["ei ikinä"],"1 day":["1 päivä"],"Account":["Tili"],"Password":["Salasana"],"Email":["Sähköposti"],"Help":["Apua"],"Resolve":["Merkitse ratkaistuksi"],"Teams":["Tiimit"],"Projects":["Projektit"],"Releases":["Julkaisut"],"Details":["Tiedot"],"Exception":["Poikkeus"],"Tags":["Tagi"],"Release":["Julkaisu"],"Previous":["Edellinen"],"Confirm":["Vahvista"],"Created":["Luotu"],"Version":["Versio"],"Change":["Muuta"],"ID":["ID"],"Device":["Laite"],"Operating System":["Käyttöjärjestelmä"],"User":["Käyttäjä"],"Language":["Kieli"],"Status":["Status"],"Unknown Browser":["Tuntematon selain"],"Unknown Device":["Tuntematon laite"],"Version:":["Versio:"],"Unknown":["Tuntematon"],"Unknown OS":["Tuntumaton käyttöjärjestelmä"],"Unknown User":["Tuntematon käyttäjä"],"Actions":["Toiminnot"],"Raw":["Raaka"],"Additional Data":["Lisätiedot"],"Event ID":["Tapahtuma-ID"],"SDK":["SDK"],"Original":["Alkuperäinen"],"Minified":["Pienennetty"],"most recent call first":["viimeisin kutsu ensin"],"most recent call last":["viimeisin kutsu viimeisenä"],"Path":["Polku"],"Toggle Context":["Kytke konteksti"],"Message":["Viesti"],"Cookies":["Evästeet"],"Headers":["Otsikot"],"Environment":["Ympäristö"],"Body":["Sisältö"],"Filename":["Tiedostonimi"],"Label":["Nimike"],"Packages":["Paketit"],"Docs":["Dokumentaatio"],"Contribute":["Avusta"],"Link":["Linkki"],"Create Team":["Luo tiimi"],"Back":["Takaisin"],"Skip this step":["Ohita tämä askel"],"Email Address":["Sähköpostiosoite"],"Create a project":["Luo projekti"],"Apply":["Käytä"],"All":["Kaikki"],"Disable":["Kytke pois"],"Organization Settings":["Organisaatioasetukset"],"Project Settings":["Projektin asetukset"],"Project Details":["Projektin tiedot"],"Clear":["Tyhjennä"],"Alerts":["Hälytykset"],"Stats":["Tilastot"],"Settings":["Asetukset"],"Members":["Jäsenet"],"Admin":["Ylläpito"],"Exception Type":["Poikkeustyyppi"],"n/a":["-"],"Tag Details":["Tagin tiedot"],"Team Name":["Tiimin nimi"],"Separate multiple entries with a newline.":["Erottele useammat vaihtoehdot rivinvaihdolla."],"General":["Yleinen"],"Allowed Domains":["Sallitut toimialueet"],"Server":["Palvelin"],"Buffer":["Puskuri"],"Organizations":["Organisaatiot"],"Queue":["Jono"],"Mail":["Posti"],"Notifications":["Ilmoitukset"],"Identities":["Identiteetit"],"Configuration":["Konfiguraatio"],"API Key":["API-avain"],"Audit Log":["Tapahtumaloki"],"Rate Limits":["Nopeusrajoitukset"],"Team":["Tiimi"],"Integrations":["Integraatiot"],"Create a new account":["Luo uusi tili"],"Server Version":["Palvelimen versio"],"Python Version":["Pythonin versio"],"Configuration File":["Konfiguraatiotiedosto"],"Uptime":["Käynnissäoloaika"],"Environment not found (are you using the builtin Sentry webserver?).":["Ympäristöä ei löytynyt (käytätkö Sentry sisäänrakennettua web-palvelinta?)"],"Send an email to your account's email address to confirm that everything is configured correctly.":["Lähettää sähköposti tilisi osoitteeseen varmistaaksesi sähköpostiasetusten toiminnan."],"SMTP Settings":["SMTP-asetukset"],"From Address":["Lähettäjän osoite"],"Host":["Palvelin"],"not set":["ei asetettu"],"No":["Ei"],"Yes":["Kyllä"],"Test Settings":["Kokeile asetuksia"],"Extensions":["Laajennukset"],"Modules":["Moduulit"],"Disable the account.":["Ota tili pois käytöstä."],"Permanently remove the user and their data.":["Poista käyttäjä ja käyttäjään liittyvä data lopullisesti."],"Remove User":["Poista käyttäjä"],"Superuser":["Pääkäyttäjä"],"15 minutes":["15 minuuttia"],"24 hours":["24 tuntia"],"Save Rule":["Tallenna sääntö"],"Member":["Jäsen"],"60 minutes":["60 minuuttia"],"30 days":["30 päivää"],"History":["Historia"],"Edit Rule":["Muokkaa sääntöä"],"Login":["Kirjaudu sisään"],"All Events":["Kaikki tapahtumat"],"Enable":["Kytke päälle"],"Select a platform":["Valitse alusta"],"Create Organization":["Luo organisaatio"],"Create a New Organization":["Luo uusi organisaatio"],"Organization Name":["Organisaation nimi"],"Bookmark":["Kirjanmerkki"],"Subscribe":["Tilaa"],"Enabled":["Päällä"],"Event Details":["Tapahtuman tiedot"],"Overview":["Yleiskatsaus"],"Trends":["Trendit"],"Create a team":["Luo tiimi"],"DSN":["DSN"],"Last Event":["Viimeinen tapahtuma"],"Search":["Haku"],"Project Name":["Projektin nimi"],"Integration":["Integraatio"],"API Keys":["API-avaimet"],"Edit API Key":["Muokkaa API-avainta"],"Revoke":["Evää"],"Dashboard":["Kojelauta"],"Remove Organization":["Poista organisaatio"],"Member Settings":["Jäsenasetukset"],"Resend Invite":["Lähetä kutsu uudelleen"],"Public Key":["Julkinen avain"],"Team Details":["Tiimin tiedot"],"Add Member":["Lisää jäsen"],"Add Project":["Lisää projekti"],"Remove Team":["Poista tiimi"],"Hidden":["Piilotettu"],"Generate New Key":["Luo uusi avain"],"Secret Key":["Salainen avain"],"Project ID":["Projektitunniste"],"Client Configuration":["Asiakasohjelman konfiguraatio"],"Remove Project":["Poista projekti"],"This project cannot be removed. It is used internally by the Sentry server.":["Tätä Sentry-palvelimen sisäistä projektia ei voi poistaa."],"Event Settings":["Tapahtuma-asetukset"],"Client Security":["Asiakasohjelman turvallisuus"],"Enable Plugin":["Kytke lisäosa päälle"],"Disable Plugin":["Kytke lisäosa pois"],"Reset Configuration":["Alusta konfiguraatio"],"Create a New Team":["Luo uusi tiimi"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"fi"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/fi.051bf9a6b920d100dce29f3e7d3fc565.js.map
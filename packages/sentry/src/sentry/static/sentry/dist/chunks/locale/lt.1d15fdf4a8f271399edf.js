(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/lt"],{

/***/ "../node_modules/moment/locale/lt.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/lt.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Lithuanian [lt]
//! author : Mindaugas Mozūras : https://github.com/mmozuras

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var units = {
        ss: 'sekundė_sekundžių_sekundes',
        m: 'minutė_minutės_minutę',
        mm: 'minutės_minučių_minutes',
        h: 'valanda_valandos_valandą',
        hh: 'valandos_valandų_valandas',
        d: 'diena_dienos_dieną',
        dd: 'dienos_dienų_dienas',
        M: 'mėnuo_mėnesio_mėnesį',
        MM: 'mėnesiai_mėnesių_mėnesius',
        y: 'metai_metų_metus',
        yy: 'metai_metų_metus',
    };
    function translateSeconds(number, withoutSuffix, key, isFuture) {
        if (withoutSuffix) {
            return 'kelios sekundės';
        } else {
            return isFuture ? 'kelių sekundžių' : 'kelias sekundes';
        }
    }
    function translateSingular(number, withoutSuffix, key, isFuture) {
        return withoutSuffix
            ? forms(key)[0]
            : isFuture
            ? forms(key)[1]
            : forms(key)[2];
    }
    function special(number) {
        return number % 10 === 0 || (number > 10 && number < 20);
    }
    function forms(key) {
        return units[key].split('_');
    }
    function translate(number, withoutSuffix, key, isFuture) {
        var result = number + ' ';
        if (number === 1) {
            return (
                result + translateSingular(number, withoutSuffix, key[0], isFuture)
            );
        } else if (withoutSuffix) {
            return result + (special(number) ? forms(key)[1] : forms(key)[0]);
        } else {
            if (isFuture) {
                return result + forms(key)[1];
            } else {
                return result + (special(number) ? forms(key)[1] : forms(key)[2]);
            }
        }
    }
    var lt = moment.defineLocale('lt', {
        months: {
            format: 'sausio_vasario_kovo_balandžio_gegužės_birželio_liepos_rugpjūčio_rugsėjo_spalio_lapkričio_gruodžio'.split(
                '_'
            ),
            standalone:
                'sausis_vasaris_kovas_balandis_gegužė_birželis_liepa_rugpjūtis_rugsėjis_spalis_lapkritis_gruodis'.split(
                    '_'
                ),
            isFormat: /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?|MMMM?(\[[^\[\]]*\]|\s)+D[oD]?/,
        },
        monthsShort: 'sau_vas_kov_bal_geg_bir_lie_rgp_rgs_spa_lap_grd'.split('_'),
        weekdays: {
            format: 'sekmadienį_pirmadienį_antradienį_trečiadienį_ketvirtadienį_penktadienį_šeštadienį'.split(
                '_'
            ),
            standalone:
                'sekmadienis_pirmadienis_antradienis_trečiadienis_ketvirtadienis_penktadienis_šeštadienis'.split(
                    '_'
                ),
            isFormat: /dddd HH:mm/,
        },
        weekdaysShort: 'Sek_Pir_Ant_Tre_Ket_Pen_Šeš'.split('_'),
        weekdaysMin: 'S_P_A_T_K_Pn_Š'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'YYYY-MM-DD',
            LL: 'YYYY [m.] MMMM D [d.]',
            LLL: 'YYYY [m.] MMMM D [d.], HH:mm [val.]',
            LLLL: 'YYYY [m.] MMMM D [d.], dddd, HH:mm [val.]',
            l: 'YYYY-MM-DD',
            ll: 'YYYY [m.] MMMM D [d.]',
            lll: 'YYYY [m.] MMMM D [d.], HH:mm [val.]',
            llll: 'YYYY [m.] MMMM D [d.], ddd, HH:mm [val.]',
        },
        calendar: {
            sameDay: '[Šiandien] LT',
            nextDay: '[Rytoj] LT',
            nextWeek: 'dddd LT',
            lastDay: '[Vakar] LT',
            lastWeek: '[Praėjusį] dddd LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: 'po %s',
            past: 'prieš %s',
            s: translateSeconds,
            ss: translate,
            m: translateSingular,
            mm: translate,
            h: translateSingular,
            hh: translate,
            d: translateSingular,
            dd: translate,
            M: translateSingular,
            MM: translate,
            y: translateSingular,
            yy: translate,
        },
        dayOfMonthOrdinalParse: /\d{1,2}-oji/,
        ordinal: function (number) {
            return number + '-oji';
        },
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return lt;

})));


/***/ }),

/***/ "../src/sentry/locale/lt/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/lt/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Slapyvardis"],"Default (let Sentry decide)":["Numatytas (Santry nuspręs)"],"Remove":["Ištrinti"],"Name":["Vardas"],"URL":["Nuoroda"],"Project":["Projektas"],"Events":["Įvykiai"],"Users":["Vartotojai"],"Cancel":["Atšaukti"],"Lost your password?":["Pamiršote savo slaptažodį?"],"Sign out":["Atsijungti"],"Next":["Kitas"],"Save Changes":["Išsaugoti pakeitimus"],"Method":["Metodas"],"Query":["Užklausa"],"ID:":["ID:"],"Username:":["Slapyvardis:"],"never":["niekada"],"1 day":["1 dieną"],"Account":["Paskyra"],"Password":["Slaptažodis"],"Email":["El. paštas"],"Close":["Uždaryti"],"Invite Member":["Pakviesti narį"],"Projects":["Projektai"],"Tags":["Žymės"],"Previous":["Praeitas"],"Confirm":["Patvirtinti"],"Created":["Sukurta"],"Setup":["Nustatyti"],"ID":["ID"],"User":["Vartotojas"],"Language":["Kalba"],"System":["Sistema"],"API":["API"],"Docs":["Dokumentacija"],"Last 24 Hours":["Per paskutines 24 valandas"],"Last 30 Days":["Per paskutinių 30 dienų"],"Email Address":["El. pašto adresas"],"Oldest":["Seniausi"],"Older":["Senesni"],"Newer":["Naujesni"],"Newest":["Naujausi"],"Disable":["Išjungti"],"Project Settings":["Projekto nustatymai"],"Settings":["Nustatymai"],"Members":["Nariai"],"Use a 24-hour clock":["Naudoti 24 valandų laikrodį"],"Organizations":["Organizacijos"],"Organization":["Organizacija"],"Identities":["Paskyros"],"Client Keys":["Kliento raktai"],"Configuration":["Konfiguracija"],"Integrations":["Integracijos"],"Server Version":["Serverio versija"],"Python Version":["Python versija"],"Configuration File":["Konfiguracijos failas"],"not set":["nenustatytas"],"No":["Ne"],"Yes":["Taip"],"Test Settings":["Testuoti nustatymus"],"Extensions":["Plėtiniai"],"Modules":["Moduliai"],"Remove User":["Ištrinti vartotoją"],"Superuser":["Super vartotojas"],"SMTP Username":["SMTP Slapyvardis"],"SMTP Password":["SMTP Slaptažodis"],"Member":["Narys"],"all":["visi"],"History":["Istorija"],"Login":["Prisijungti"],"Saved Searches":["Išsaugotos paieškos"],"Enable":["Įjungti"],"Create Project":["Sukurti projektą"],"Create Organization":["Sukurti organizaciją"],"Create a New Organization":["Sukurti naują organizaciją"],"The issue you were looking for was not found.":["Ši klaida, kurios ieškojote, nerasta."],"Overview":["Apžvalga"],"DSN":["DSN"],"API Keys":["API Raktai"],"Edit API Key":["Pakeisti API raktą"],"Key":["Raktas"],"Revoke":["Panaikinti"],"Remove Organization":["Ištrinti organizaciją"],"Added":["Pridėta"],"Resend Invite":["Siųsti pakvietimą iš naujo"],"Public Key":["Viešas raktas"],"Client Keys (DSN)":["Kliento raktai (DSN)"],"Generate New Key":["Sugeneruoti naują raktą"],"Secret Key":["Saugus raktas"],"Project ID":["Projekto ID"],"Remove Project":["Ištrinti projektą"],"Event Settings":["Įvykių nustatymai"],"Reset Configuration":["Atstatyti konfiguraciją"],"Instructions":["Instrukcijos"],"":{"domain":"sentry","plural_forms":"nplurals=4; plural=(n % 10 == 1 && (n % 100 > 19 || n % 100 < 11) ? 0 : (n % 10 >= 2 && n % 10 <=9) && (n % 100 > 19 || n % 100 < 11) ? 1 : n % 1 != 0 ? 2: 3);","lang":"lt"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/lt.ee65fe691e70cdf555f46edfc2ef3314.js.map
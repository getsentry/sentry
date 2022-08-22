(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/ca"],{

/***/ "../node_modules/moment/locale/ca.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/ca.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Catalan [ca]
//! author : Juan G. Hurtado : https://github.com/juanghurtado

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var ca = moment.defineLocale('ca', {
        months: {
            standalone:
                'gener_febrer_març_abril_maig_juny_juliol_agost_setembre_octubre_novembre_desembre'.split(
                    '_'
                ),
            format: "de gener_de febrer_de març_d'abril_de maig_de juny_de juliol_d'agost_de setembre_d'octubre_de novembre_de desembre".split(
                '_'
            ),
            isFormat: /D[oD]?(\s)+MMMM/,
        },
        monthsShort:
            'gen._febr._març_abr._maig_juny_jul._ag._set._oct._nov._des.'.split(
                '_'
            ),
        monthsParseExact: true,
        weekdays:
            'diumenge_dilluns_dimarts_dimecres_dijous_divendres_dissabte'.split(
                '_'
            ),
        weekdaysShort: 'dg._dl._dt._dc._dj._dv._ds.'.split('_'),
        weekdaysMin: 'dg_dl_dt_dc_dj_dv_ds'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'H:mm',
            LTS: 'H:mm:ss',
            L: 'DD/MM/YYYY',
            LL: 'D MMMM [de] YYYY',
            ll: 'D MMM YYYY',
            LLL: 'D MMMM [de] YYYY [a les] H:mm',
            lll: 'D MMM YYYY, H:mm',
            LLLL: 'dddd D MMMM [de] YYYY [a les] H:mm',
            llll: 'ddd D MMM YYYY, H:mm',
        },
        calendar: {
            sameDay: function () {
                return '[avui a ' + (this.hours() !== 1 ? 'les' : 'la') + '] LT';
            },
            nextDay: function () {
                return '[demà a ' + (this.hours() !== 1 ? 'les' : 'la') + '] LT';
            },
            nextWeek: function () {
                return 'dddd [a ' + (this.hours() !== 1 ? 'les' : 'la') + '] LT';
            },
            lastDay: function () {
                return '[ahir a ' + (this.hours() !== 1 ? 'les' : 'la') + '] LT';
            },
            lastWeek: function () {
                return (
                    '[el] dddd [passat a ' +
                    (this.hours() !== 1 ? 'les' : 'la') +
                    '] LT'
                );
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: "d'aquí %s",
            past: 'fa %s',
            s: 'uns segons',
            ss: '%d segons',
            m: 'un minut',
            mm: '%d minuts',
            h: 'una hora',
            hh: '%d hores',
            d: 'un dia',
            dd: '%d dies',
            M: 'un mes',
            MM: '%d mesos',
            y: 'un any',
            yy: '%d anys',
        },
        dayOfMonthOrdinalParse: /\d{1,2}(r|n|t|è|a)/,
        ordinal: function (number, period) {
            var output =
                number === 1
                    ? 'r'
                    : number === 2
                    ? 'n'
                    : number === 3
                    ? 'r'
                    : number === 4
                    ? 't'
                    : 'è';
            if (period === 'w' || period === 'W') {
                output = 'a';
            }
            return number + output;
        },
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return ca;

})));


/***/ }),

/***/ "../src/sentry/locale/ca/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/ca/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Remove":["Elimina"],"Priority":["Prioritat"],"Last Seen":["Vist per darrera vegada"],"First Seen":["Vist per primera vegada"],"Frequency":["Freqüència"],"Score":["Marcador"],"Name":["Nom"],"URL":["URL"],"Project":["Projecte"],"Unresolved":["No resolts"],"Resolved":["Resolts"],"error":["error"],"Events":["Events"],"Users":["Usuaris"],"user":["usuari"],"Page Not Found":["Plana no trobada"],"The page you are looking for was not found.":["No hem pogut trobar la plana que cerques."],"Cancel":["Cancel·la"],"Submit":["Enviar"],"Next":["Següent"],"Save Changes":["Guardar els canvis"],"Query":["Consulta"],"ID:":["ID:"],"Username:":["Nom d'usuari:"],"m":["m"],"never":["mai"],"1 day":["1 dia"],"Account":["Compta"],"Password":["Clau"],"Email":["Adreça"],"Edit":["Editar"],"Teams":["Equips"],"Projects":["Projectes"],"Details":["Detalls"],"Exception":["Excepció"],"Tags":["Etiquetes"],"Previous":["Anterior"],"Confirm":["Confirma"],"Version":["Versió"],"Operating System":["Sistema operatiu"],"User":["Usuari"],"Language":["Idioma"],"Status":["Estat"],"Expand":["Expandir"],"Actions":["Accions"],"Raw":["Cruu"],"Additional Data":["Dades addicionals"],"Level":["NIvell"],"Message":["Missatge"],"Cookies":["Galletes"],"Headers":["Capçaleres"],"Environment":["Entorn"],"Body":["Cos"],"Packages":["Paquets"],"Regression":["Regressió"],"Apply":["Aplicar"],"All":["Tot"],"Project Details":["Detalls del projecte"],"Stats":["Estadístiques"],"Settings":["Configuració"],"Members":["Membres"],"Admin":["Administració"],"n/a":["n/a"],"Queue":["Coa"],"Mail":["Correu"],"Notifications":["Notificacions"],"Configuration":["Configuració"],"Server Version":["Versió del servidor"],"Python Version":["Versió de Python"],"Configuration File":["Fitxer de configuració"],"Uptime":["Engegat"],"Environment not found (are you using the builtin Sentry webserver?).":["Entorn no trobat (estàs fent servir el servidor web encastat de Sentry?)."],"Extensions":["Extensions"],"Modules":["Mòduls"],"Disable the account.":["Desactivar el compte."],"Permanently remove the user and their data.":["Esborrar de forma permanent l'usuari i les seves dades."],"Remove User":["Eliminar usuari"],"15 minutes":["15 minuts"],"24 hours":["24 hores"],"60 minutes":["60 minuts"],"30 days":["30 dies"],"Login":["Entrar"],"All Events":["Tots els events"],"Bookmark":["Marcador"],"Enabled":["Actiu"],"Event Details":["Detalls de l'event"],"Overview":["Resum"],"Trends":["Tendències"],"Restore":["Restaura"],"Last Event":["Darrer event"],"Search":["Cercar"],"Revoke":["Revoca"],"Dashboard":["Panell de control"],"Public Key":["Clau pública"],"Team Details":["Detalls de l'equip"],"Remove Team":["Esborrar equip"],"Secret Key":["Clau secreta"],"Client Configuration":["Configuració del client"],"Remove Project":["Eliminar projecte"],"Client Security":["Seguretat del client"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"ca"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/ca.d48eabed12164361210811ff388b94eb.js.map
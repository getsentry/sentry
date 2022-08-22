(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/gl"],{

/***/ "../node_modules/moment/locale/gl.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/gl.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Galician [gl]
//! author : Juan G. Hurtado : https://github.com/juanghurtado

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var gl = moment.defineLocale('gl', {
        months: 'xaneiro_febreiro_marzo_abril_maio_xuño_xullo_agosto_setembro_outubro_novembro_decembro'.split(
            '_'
        ),
        monthsShort:
            'xan._feb._mar._abr._mai._xuñ._xul._ago._set._out._nov._dec.'.split(
                '_'
            ),
        monthsParseExact: true,
        weekdays: 'domingo_luns_martes_mércores_xoves_venres_sábado'.split('_'),
        weekdaysShort: 'dom._lun._mar._mér._xov._ven._sáb.'.split('_'),
        weekdaysMin: 'do_lu_ma_mé_xo_ve_sá'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'H:mm',
            LTS: 'H:mm:ss',
            L: 'DD/MM/YYYY',
            LL: 'D [de] MMMM [de] YYYY',
            LLL: 'D [de] MMMM [de] YYYY H:mm',
            LLLL: 'dddd, D [de] MMMM [de] YYYY H:mm',
        },
        calendar: {
            sameDay: function () {
                return '[hoxe ' + (this.hours() !== 1 ? 'ás' : 'á') + '] LT';
            },
            nextDay: function () {
                return '[mañá ' + (this.hours() !== 1 ? 'ás' : 'á') + '] LT';
            },
            nextWeek: function () {
                return 'dddd [' + (this.hours() !== 1 ? 'ás' : 'a') + '] LT';
            },
            lastDay: function () {
                return '[onte ' + (this.hours() !== 1 ? 'á' : 'a') + '] LT';
            },
            lastWeek: function () {
                return (
                    '[o] dddd [pasado ' + (this.hours() !== 1 ? 'ás' : 'a') + '] LT'
                );
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: function (str) {
                if (str.indexOf('un') === 0) {
                    return 'n' + str;
                }
                return 'en ' + str;
            },
            past: 'hai %s',
            s: 'uns segundos',
            ss: '%d segundos',
            m: 'un minuto',
            mm: '%d minutos',
            h: 'unha hora',
            hh: '%d horas',
            d: 'un día',
            dd: '%d días',
            M: 'un mes',
            MM: '%d meses',
            y: 'un ano',
            yy: '%d anos',
        },
        dayOfMonthOrdinalParse: /\d{1,2}º/,
        ordinal: '%dº',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return gl;

})));


/***/ }),

/***/ "../src/sentry/locale/gl/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/gl/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Nome de usuario"],"Default (let Sentry decide)":["Predeterminado (deixar que Sentry decida)"],"Most recent call last":["Chamada máis recente ao final"],"Most recent call first":["Chamada máis recente ao comezo"],"Remove":["Retirar"],"Priority":["Prioridade"],"Last Seen":["Última detección"],"First Seen":["Primeira detección"],"Frequency":["Frecuencia"],"Score":["Valoración"],"Name":["Nome"],"URL":["URL"],"Project":["Proxecto"],"Unresolved":["Non resolta"],"Resolved":["Resolta"],"error":["erro"],"Events":["Eventos"],"Users":["Usuarios"],"Page Not Found":["Páxina non atopada"],"The page you are looking for was not found.":["Non se atopou a páxina que está buscando."],"Cancel":["Cancelar"],"Submit":["Enviar"],"Next":["Seguinte"],"Register":["Rexistrar"],"Save Changes":["Gardar os cambios"],"ID:":["ID:"],"Username:":["Nome de usuario:"],"m":["m"],"never":["nunca"],"1 day":["1 día"],"Account":["Conta"],"Password":["Contrasinal"],"Email":["Correo-e"],"Teams":["Equipos"],"Projects":["Proxectos"],"Details":["Detalles"],"Exception":["Excepción"],"Tags":["Etiquetas"],"Previous":["Anterior"],"Confirm":["Confirmar"],"Version":["Versión"],"Change":["Cambiar"],"Operating System":["Sistema operativo"],"User":["Usuario"],"Language":["Idioma"],"Status":["Estado"],"Actions":["Accións"],"Raw":["En bruto"],"Additional Data":["Datos adicionais"],"Event ID":["ID de evento"],"most recent call first":["chamada máis recente primeiro"],"most recent call last":["chamada máis recente ao final"],"Path":["Ruta"],"Toggle Context":["Mostrar/ocultar o contexto"],"Environment":["Ambiente"],"Filename":["Nome de ficheiro"],"Packages":["Paquetes"],"Contribute":["Contribuír"],"Link":["Ligazón"],"Regression":["Regresión"],"Create Team":["Crear equipo"],"Email Address":["Enderezo de correo-e"],"Apply":["Aplicar"],"Project Settings":["Configuración do proxecto"],"Project Details":["Detalles do proxecto"],"Clear":["Limpar"],"Alerts":["Alertas"],"Stats":["Estatísticas"],"Settings":["Configuración"],"Members":["Membros"],"Admin":["Administración"],"n/a":["n/a"],"Tag Details":["Detalles da etiqueta"],"Team Name":["Nome do equipo"],"Separate multiple entries with a newline.":["Se hai varias entradas sepáreas cun salto de liña."],"General":["Xeral"],"Allowed Domains":["Dominios permitidos"],"Mail":["Correo"],"Notifications":["Notificacións"],"Identities":["Identidades"],"Configuration":["Configuración"],"API Key":["Chave da API"],"Rate Limits":["Cota de eventos"],"Team":["Equipo"],"Integrations":["Integracións"],"Create a new account":["Crear unha nova conta"],"Server Version":["Versión do servidor"],"Python Version":["Versión de Python"],"Configuration File":["Ficheiro de configuración"],"Uptime":["Tempo de execución"],"Environment not found (are you using the builtin Sentry webserver?).":["Non se atopou o ambiente (está empregando o servidor web incorporado de Sentry)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Enviar unha mensaxe ao enderezo de correo-e da súa conta para confirmar que todo está configurado correctamente."],"SMTP Settings":["Configuración de SMTP"],"Host":["Servidor"],"not set":["non definido"],"No":["Non"],"Yes":["Si"],"Test Settings":["Probar a configuración"],"Extensions":["Extensións"],"Modules":["Módulos"],"Disable the account.":["Desactivar a conta."],"Permanently remove the user and their data.":["Retirar permanentemente o usuario e os seus datos."],"Remove User":["Retirar usuario"],"Designates whether this user can perform administrative functions.":["Indica se este usuario pode realizar funcións de administración."],"15 minutes":["15 minutos"],"24 hours":["24 horas"],"60 minutes":["60 minutos"],"Login":["Acceder"],"All Events":["Todos os eventos"],"Select a platform":["Seleccione unha plataforma"],"Bookmark":["Marcador"],"Enabled":["Activado"],"Overview":["Resumo"],"Trends":["Tendencias"],"Search":["Buscar"],"Project Name":["Nome do proxecto"],"Integration":["Integración"],"API Keys":["Chaves da API"],"Revoke":["Revogar"],"Dashboard":["Panel"],"Pending Members":["Membros pendentes"],"Team Details":["Detalles do equipo"],"Add Member":["Engadir membro"],"Add Project":["Engadir proxecto"],"Remove Team":["Retirar equipo"],"Hidden":["Oculto"],"Generate New Key":["Xerar nova chave"],"Client Configuration":["Configuración do cliente"],"Remove Project":["Retirar proxecto"],"This project cannot be removed. It is used internally by the Sentry server.":["Non se pode retirar este proxecto. Estáo a empregar internamente o servidor Sentry."],"Event Settings":["Configuración de evento"],"Client Security":["Seguridade do cliente"],"Enable Plugin":["Activar complemento"],"Disable Plugin":["Desactivar complemento"],"Reset Configuration":["Restaurar a configuración"],"Create a New Team":["Crear un novo equipo"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"gl"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/gl.8920f5ecbd94c1402b1cc5fbe2c2c2f6.js.map
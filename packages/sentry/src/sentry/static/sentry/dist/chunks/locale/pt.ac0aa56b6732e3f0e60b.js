(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/pt"],{

/***/ "../node_modules/moment/locale/pt.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/pt.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Portuguese [pt]
//! author : Jefferson : https://github.com/jalex79

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var pt = moment.defineLocale('pt', {
        months: 'janeiro_fevereiro_março_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro'.split(
            '_'
        ),
        monthsShort: 'jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez'.split('_'),
        weekdays:
            'Domingo_Segunda-feira_Terça-feira_Quarta-feira_Quinta-feira_Sexta-feira_Sábado'.split(
                '_'
            ),
        weekdaysShort: 'Dom_Seg_Ter_Qua_Qui_Sex_Sáb'.split('_'),
        weekdaysMin: 'Do_2ª_3ª_4ª_5ª_6ª_Sá'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD/MM/YYYY',
            LL: 'D [de] MMMM [de] YYYY',
            LLL: 'D [de] MMMM [de] YYYY HH:mm',
            LLLL: 'dddd, D [de] MMMM [de] YYYY HH:mm',
        },
        calendar: {
            sameDay: '[Hoje às] LT',
            nextDay: '[Amanhã às] LT',
            nextWeek: 'dddd [às] LT',
            lastDay: '[Ontem às] LT',
            lastWeek: function () {
                return this.day() === 0 || this.day() === 6
                    ? '[Último] dddd [às] LT' // Saturday + Sunday
                    : '[Última] dddd [às] LT'; // Monday - Friday
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: 'em %s',
            past: 'há %s',
            s: 'segundos',
            ss: '%d segundos',
            m: 'um minuto',
            mm: '%d minutos',
            h: 'uma hora',
            hh: '%d horas',
            d: 'um dia',
            dd: '%d dias',
            w: 'uma semana',
            ww: '%d semanas',
            M: 'um mês',
            MM: '%d meses',
            y: 'um ano',
            yy: '%d anos',
        },
        dayOfMonthOrdinalParse: /\d{1,2}º/,
        ordinal: '%dº',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return pt;

})));


/***/ }),

/***/ "../src/sentry/locale/pt/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/pt/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Nome de Utilizador"],"Permissions":["Permissões"],"Default (let Sentry decide)":["Padrão (deixe o Sentry decidir)"],"Most recent call last":["Chamada mais recente última"],"Most recent call first":["Chamada mais recente primeiro"],"Info":["Informação"],"Remove":["Remover"],"Priority":["Prioridade"],"Last Seen":["Última Ocorrência"],"First Seen":["Primeira Ocorrência"],"Frequency":["Frequência"],"Score":["Pontuação"],"Name":["Nome"],"URL":["URL"],"Project":["Projeto"],"Active":["Activo"],"Unresolved":["Por resolver"],"Resolved":["Resolvido"],"error":["erro"],"Events":["Eventos"],"Users":["Utilizadores"],"user":["utilizador"],"Page Not Found":["Página Não Encontrada"],"The page you are looking for was not found.":["A página que procura não foi encontrada"],"Cancel":["Cancelar"],"Sign out":["Sair"],"Submit":["Submeter"],"Next":["Próximo"],"Register":["Registar"],"Auth":["Autenticação"],"Save Changes":["Gravar Alterações"],"Query":["Query"],"ID:":["ID:"],"Username:":["Utilizador:"],"m":["m"],"never":["nunca"],"1 day":["1 dia"],"Account":["Conta"],"Password":["Password"],"Email":["Email"],"Resolve":["Resolver"],"Edit":["Editar"],"Teams":["Equipas"],"Invite Member":["Convidar Membro"],"Projects":["Projetos"],"Issues":["Problemas"],"Releases":["Releases"],"Details":["Detalhes"],"Exception":["Exceção"],"Tags":["Etiquetas"],"Breadcrumbs":["Breadcrumbs"],"Previous":["Anterior"],"Confirm":["Confirmar"],"Version":["Versão"],"Change":["Alterar"],"Operating System":["Sistema Operativo"],"User":["Utilizador"],"Language":["Linguagem"],"Status":["Estado"],"Expand":["Expandir"],"Actions":["Ações"],"Raw":["Raw"],"Additional Data":["Dados Adicionais"],"Event ID":["Identificação do Evento"],"Level":["Level"],"most recent call first":["chamada mais recente primeiro"],"most recent call last":["chamada mais recente por último"],"Path":["Caminho"],"Toggle Context":["Alternar Contexto"],"Message":["Mensagem"],"Cookies":["Cookies"],"Headers":["Cabeçalhos"],"Environment":["Ambiente"],"Body":["Corpo"],"Filename":["Nome de ficheiro"],"Packages":["Pacotes"],"API":["API"],"Contribute":["Contribua"],"Migrate to SaaS":["Migrar para SaaS"],"Link":["Link"],"Regression":["Regressão"],"Inactive Integrations":["Integrações Inactivas"],"Create Team":["Crie Equipa"],"Role":["Papel"],"Email Address":["Endereço de Email"],"Apply":["Aplicar"],"All":["Todos"],"Project Settings":["Configurações de Projetos"],"Project Details":["Detalhes do Projeto"],"Clear":["Limpar"],"Alerts":["Alertas"],"Stats":["Estatísticas"],"Settings":["Configurações"],"Members":["Membros"],"Admin":["Admin"],"n/a":["n/d"],"Tag Details":["Etiquete Detalhes"],"Team Name":["Nome da Equipa"],"Separate multiple entries with a newline.":["Separe várias entradas através de uma quebra de linha."],"General":["Geral"],"Allowed Domains":["Domínios Permitidos"],"Queue":["Fila"],"Mail":["Correio"],"Notifications":["Notificações"],"Identities":["Identidades"],"Close Account":["Fechar Conta"],"Configuration":["Configuração"],"API Key":["Chave da API"],"Team":["Equipa"],"Integrations":["Integrações"],"Create a new account":["Criar uma nova conta"],"Server Version":["Versão do Servidor"],"Python Version":["Versão do Python"],"Configuration File":["Ficheiro de Configuração"],"Uptime":["Tempo de serviço"],"Environment not found (are you using the builtin Sentry webserver?).":["Ambiente não encontrado (está a usar o servidor web interno do Sentry?)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Envie um email para o endereço de email da sua conta para confirmar se tudo está configurado corretamente."],"SMTP Settings":["Configurações SMTP"],"Host":["Host"],"not set":["não definido"],"No":["Não"],"Yes":["Sim"],"Test Settings":["Teste de Configurações"],"Extensions":["Extensões"],"Modules":["Módulos"],"Disable the account.":["Desabilitar a conta."],"Permanently remove the user and their data.":["Remover permanentemente o utilizador e os seus dados."],"Remove User":["Remover Utilizador"],"Designates whether this user can perform administrative functions.":["Designa se este utilizador pode efetuar funções administrativas."],"15 minutes":["15 minutos"],"24 hours":["24 horas"],"Member":["Membro"],"60 minutes":["60 minutos"],"30 days":["30 dias"],"Alert Rules":["Regras de Alertas"],"Login":["Autenticar"],"All Events":["Todos os Eventos"],"Select a platform":["Selecione a plataforma"],"Bookmark":["Bookmark"],"Enabled":["Ativado"],"Event Details":["Detalhes do Evento"],"Overview":["Visão global"],"Trends":["Tendências"],"Restore":["Restaurar"],"Last Event":["Último Evento"],"Search":["Pesquisar"],"Project Name":["Nome do Projeto"],"Your account has been deactivated and scheduled for removal.":["A sua conta foi desactivada e marcada para remoção."],"Thanks for using Sentry! We hope to see you again soon!":["Obrigado por usar o Sentry! Esperamos vê-lo novamente em breve."],"Integration":["Integração"],"API Keys":["Chaves da API"],"Key":["Chave"],"Revoke":["Revogar"],"Dashboard":["Painel de Controlo"],"Remove Organization":["Remover Organização"],"Member Settings":["Configurações do Membro"],"Basics":["Informação Básica"],"Added":["Adicionado"],"Invite Link":["Link de Convite"],"Generate New Invite":["Gerar Novo Convite"],"Resend Invite":["Reenviar Convite"],"Pending Members":["Membros Pendentes"],"Public Key":["Chave Pública"],"Team Details":["Detalhes da Equipa"],"Add Member":["Adicione Membro"],"Add Project":["Adicione Projeto"],"Remove Team":["Remover Equipa"],"Hidden":["Escondido"],"Generate New Key":["Crie Nova Chave"],"Secret Key":["Chave Secreta"],"Client Configuration":["Configuração de Cliente"],"Remove Project":["Remover Projeto"],"This project cannot be removed. It is used internally by the Sentry server.":["Este projeto não pode ser removido. É usado internamente pelo servidor Sentry."],"Event Settings":["Configurações do Evento"],"Client Security":["Segurança do Client"],"Enable Plugin":["Activar Plugin"],"Disable Plugin":["Desativar Plugin"],"Reset Configuration":["Redefinir Configuração"],"Create a New Team":["Crie uma Nova Equipa"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"pt"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/pt.4b4868bcc53cd056e2a9b0eab8a55153.js.map
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/it"],{

/***/ "../node_modules/moment/locale/it.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/it.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Italian [it]
//! author : Lorenzo : https://github.com/aliem
//! author: Mattia Larentis: https://github.com/nostalgiaz
//! author: Marco : https://github.com/Manfre98

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var it = moment.defineLocale('it', {
        months: 'gennaio_febbraio_marzo_aprile_maggio_giugno_luglio_agosto_settembre_ottobre_novembre_dicembre'.split(
            '_'
        ),
        monthsShort: 'gen_feb_mar_apr_mag_giu_lug_ago_set_ott_nov_dic'.split('_'),
        weekdays: 'domenica_lunedì_martedì_mercoledì_giovedì_venerdì_sabato'.split(
            '_'
        ),
        weekdaysShort: 'dom_lun_mar_mer_gio_ven_sab'.split('_'),
        weekdaysMin: 'do_lu_ma_me_gi_ve_sa'.split('_'),
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD/MM/YYYY',
            LL: 'D MMMM YYYY',
            LLL: 'D MMMM YYYY HH:mm',
            LLLL: 'dddd D MMMM YYYY HH:mm',
        },
        calendar: {
            sameDay: function () {
                return (
                    '[Oggi a' +
                    (this.hours() > 1 ? 'lle ' : this.hours() === 0 ? ' ' : "ll'") +
                    ']LT'
                );
            },
            nextDay: function () {
                return (
                    '[Domani a' +
                    (this.hours() > 1 ? 'lle ' : this.hours() === 0 ? ' ' : "ll'") +
                    ']LT'
                );
            },
            nextWeek: function () {
                return (
                    'dddd [a' +
                    (this.hours() > 1 ? 'lle ' : this.hours() === 0 ? ' ' : "ll'") +
                    ']LT'
                );
            },
            lastDay: function () {
                return (
                    '[Ieri a' +
                    (this.hours() > 1 ? 'lle ' : this.hours() === 0 ? ' ' : "ll'") +
                    ']LT'
                );
            },
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return (
                            '[La scorsa] dddd [a' +
                            (this.hours() > 1
                                ? 'lle '
                                : this.hours() === 0
                                ? ' '
                                : "ll'") +
                            ']LT'
                        );
                    default:
                        return (
                            '[Lo scorso] dddd [a' +
                            (this.hours() > 1
                                ? 'lle '
                                : this.hours() === 0
                                ? ' '
                                : "ll'") +
                            ']LT'
                        );
                }
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: 'tra %s',
            past: '%s fa',
            s: 'alcuni secondi',
            ss: '%d secondi',
            m: 'un minuto',
            mm: '%d minuti',
            h: "un'ora",
            hh: '%d ore',
            d: 'un giorno',
            dd: '%d giorni',
            w: 'una settimana',
            ww: '%d settimane',
            M: 'un mese',
            MM: '%d mesi',
            y: 'un anno',
            yy: '%d anni',
        },
        dayOfMonthOrdinalParse: /\d{1,2}º/,
        ordinal: '%dº',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return it;

})));


/***/ }),

/***/ "../src/sentry/locale/it/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/it/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Nome Utente"],"Permissions":["Permessi"],"Default (let Sentry decide)":["Predefinito (lascia che sia Sentry a decidere)"],"Most recent call last":["Le chiamate più recenti alla fine"],"Most recent call first":["Le chiamate più recenti all'inizio"],"Info":["Informazioni"],"Remove":["Rimuovi"],"Configure":["Configura"],"Continue":["Continua"],"Priority":["Priorità"],"Last Seen":["Ultima Occorrenza"],"First Seen":["Prima Occorrenza"],"Frequency":["Frequenza"],"Score":["Punteggio"],"Name":["Nome"],"URL":["URL"],"Project":["Progetto"],"Active":["Attivo"],"Unresolved":["Non risolto"],"Resolved":["Risolto"],"error":["errore"],"Events":["Eventi:"],"Users":["Utenti"],"name":["nome"],"user":["utente"],"Page Not Found":["Pagina Non Trovata"],"The page you are looking for was not found.":["La pagina che stai cercando non è stata trovata."],"Cancel":["Cancella"],"Confirm Password":["Conferma password"],"Lost your password?":["Hai perso la password?"],"Sign out":["Esci"],"Submit":["Conferma"],"Next":["Successivo"],"Register":["Registrati"],"Single Sign-On":["Accesso singolo"],"Auth":["Auth"],"Save Changes":["Salva le modifiche"],"Method":["Metodo"],"Query":["Query"],"Fragment":["Frammenta"],"ID:":["ID:"],"Username:":["Nome Utente:"],"Create Issue":["Crea richiesta"],"m":["m"],"never":["mai"],"1 day":["1 giorno"],"Account":["Account"],"username or email":["nome utente o email"],"Password":["Password"],"password":["password"],"Email":["Email"],"Close":["Chiudi"],"Default Role":["Ruolo predefinito"],"Help":["Aiuto"],"Unresolve":["Non risolto"],"Resolve":["Risolvi"],"This event is resolved due to the Auto Resolve configuration for this project":["Questo evento è stato risolto grazie alla configurazione Risoluzione automatica per questo progetto"],"Edit":["Modifica"],"Are you sure you wish to delete this comment?":["Sei sicuro di voler rimuovere questo commento?"],"Save Comment":["Salva commento"],"Post Comment":["Pubblica commento"],"Write":["Scrivi"],"Markdown supported":["Markdown supportato"],"Teams":["Teams"],"Invite Member":["Invita Membro"],"Projects":["Progetti"],"Issues":["Richieste"],"Releases":["Versioni"],"Details":["Dettagli:"],"Exception":["Eccezione"],"Tags":["Etichette"],"Release":["Versione"],"Avatar":["Avatar"],"Previous":["Precedente"],"Collapse":["Chiudi"],"Confirm":["Conferma"],"Date":["Data"],"Created":["Creato"],"Version":["Versione"],"Sort by":["Ordina per"],"Change":["Cambia"],"Setup":["Impostazione"],"Retry":["Riprova"],"Operating System":["Sistema Operativo"],"User":["Utente"],"Language":["Lingua"],"Status":["Stato"],"Expand":["Espandi"],"Hide":["Nascondi"],"Show":["Mostra"],"Delete":["Elimina"],"Size":["Dimensione"],"Actions":["Azioni"],"Show more":["Mostra altro"],"Snooze":["Posticipa"],"Raw":["Raw"],"Additional Data":["Dati addizionali"],"Event ID":["ID evento"],"Level":["Livello"],"System":["Sistema"],"Full":["Totale"],"App Only":["Solo app"],"most recent call first":["le chiamate più recenti all'inizio"],"most recent call last":["le chiamate più recenti alla fine"],"Report":["Report"],"CSP Report":["Report CSP"],"Path":["Percorso"],"in":["in"],"at line":["alla linea"],"Source Map":["Mappa sorgente"],"Toggle Context":["Alterna Contesto"],"Message":["Messaggio"],"Query String":["Stringa di richiesta"],"Cookies":["Cookies"],"Headers":["Headers"],"Environment":["Ambiente"],"Body":["Body"],"Template":["Modello"],"Filename":["Nome del file"],"Label":["Etichetta"],"Packages":["Package"],"API":["API"],"Docs":["Documenti"],"Contribute":["Contribuisci"],"Link":["Collegamento"],"Regression":["Pregresso"],"First seen":["Prima occorrenza"],"Last seen":["Ultima occorrenza"],"Last 24 Hours":["Ultime 24 ore"],"Last 30 Days":["Ultimi 30 giorni"],"Inactive Integrations":["Integrazioni non attive"],"There don't seem to be any events fitting the query.":["Non sembrano esserci eventi corrispondenti alla richiesta."],"events":["eventi"],"There was an error loading data.":["Si è verificato un errore durante il caricamento dei dati."],"Create Team":["Crea Team"],"Back":["Indietro"],"Role":["Ruolo"],"Email Address":["Indirizzo e-mail"],"You will not be notified of any changes and it will not show up by default in feeds.":["Non ti verrà notificata alcuna modifica e non verrà mostrata come impostazione predefinita nei feed."],"Oldest":["Il più vecchio"],"Older":["Più vecchio"],"Newer":["Più nuovo"],"Newest":["Il più nuovo"],"Apply":["Applica"],"Filter projects":["Filtra progetti"],"All":["Tutti"],"Disable":["Disattiva"],"Request Access":["Richiedi l'accesso"],"Join Team":["Unisciti al team"],"Request Pending":["Richiesta in attesa"],"Event":["Evento"],"Organization Settings":["Impostazioni organizzazione"],"Project Settings":["Impostazioni del progetto"],"Project Details":["Dettagli del progetto"],"Clear":["Cancella"],"Alerts":["Allarmi"],"Stats":["Statistiche"],"Settings":["Impostazioni"],"Members":["Membri"],"Admin":["Amministrazione"],"Exception Type":["Tipo Eccezione"],"n/a":["N.D."],"Tag Details":["Dettagli tag"],"Team Name":["Nome Team"],"New Issues":["Nuove richieste"],"Last 24 hours":["Ultime 24 ore"],"Unknown error. Please try again.":["Errore sconosciuto. Riprovare."],"Weekly Reports":["Report settimanali"],"Use a 24-hour clock":["Utilizza un orologio di 24 ore"],"Separate multiple entries with a newline.":["Separa più voci con un ritorno a capo."],"General":["Generale"],"Open Membership":["Iscrizione aperta"],"Enhanced Privacy":["Privacy potenziata"],"Allowed Domains":["Domini Ammessi"],"Enable JavaScript source fetching":["Abilita caricamento sorgente JavaScript"],"Data Scrubber":["Data Scrubber"],"Server":["Server"],"Organizations":["Organizzazioni"],"Queue":["Coda"],"Mail":["Mail"],"Organization":["Organizzazione"],"Notifications":["Notifiche"],"Emails":["Email"],"Security":["Sicurezza"],"Identities":["Identità"],"Close Account":["Chiudi account"],"Release Tracking":["Tracciamento versione"],"Client Keys":["Chiavi client"],"Configuration":["Configurazione"],"API Key":["Api Key"],"Audit Log":["Registro di controllo"],"Rate Limits":["Limiti di Frequenza"],"Team":["Team"],"Integrations":["Integrazioni"],"Unable to change assignee. Please try again.":["Impossibile cambiare assegnatario. Riprovare."],"Unable to delete events. Please try again.":["Impossibile eliminare gli eventi. Riprovare."],"The selected events have been scheduled for deletion.":["Gli eventi selezionati sono stati programmati per la cancellazione."],"Unable to merge events. Please try again.":["Impossibile unire gli eventi. Riprovare."],"The selected events have been scheduled for merge.":["Gli eventi selezionati sono stati programmati per l'unione."],"Unable to update events. Please try again.":["Impossibile aggiornare gli eventi. Riprovare."],"Create a new account":["Crea un nuovo account"],"Server Version":["Versione del Server"],"Python Version":["Versione di Python"],"Configuration File":["File di Configurazione"],"Uptime":["Uptime"],"Environment not found (are you using the builtin Sentry webserver?).":["Ambiente non trovato (stai usando il webserver Sentry built-in?)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Invia una email all'indirizzo di posta elettronica del tuo account per verificare che tutto sia configurato correttamente."],"SMTP Settings":["Impostazioni SMTP"],"From Address":["Indirizzo Mittente"],"Host":["Host"],"not set":["non impostato"],"No":["No"],"Yes":["Sì"],"Test Settings":["Prova le Impostazioni"],"Accepted":["Accettato"],"Dropped":["Scartato"],"Extensions":["Estensioni"],"Modules":["Moduli"],"Disable the account.":["Disabilita l'account."],"Permanently remove the user and their data.":["Rimuovi permanentemente l'utente e i suoi dati."],"Remove User":["Rimuovi Utente"],"Designates whether this user can perform administrative functions.":["Designa se questo utente può eseguire funzioni amministrative."],"Superuser":["Superuser"],"Designates whether this user has all permissions without explicitly assigning them.":["Indica se questo utente ha tutti i permessi, senza doverli assegnare esplicitamente."],"The project you were looking for was not found.":["Il progetto che stai cercando non è stato trovato."],"15 minutes":["15 minuti"],"1 hour":["1 ora"],"24 hours":["24 ore"],"Save Rule":["Salva Regola"],"Member":["Membro"],"60 minutes":["60 minuti"],"1 week":["1 settimana"],"all":["tutti"],"any":["qualsiasi"],"none":["nessuno"],"History":["Storico"],"Edit Rule":["Cambia Regola"],"Login":["Accesso"],"All Events":["Tutti gli eventi"],"Add to Bookmarks":["Aggiungi ai segnalibri"],"Remove from Bookmarks":["Rimuovi dai segnalibri"],"Set status to: Unresolved":["Imposta lo stato su: non risolto"],"Graph:":["Grafico:"],"24h":["24h"],"This action cannot be undone.":["Questa azione non è revocabile."],"Tag":["Tag"],"Text":["Testo"],"Search title and culprit text body":["Cerca titolo e corpo del testo responsabile"],"Enable":["Attiva"],"Select a platform":["Seleziona una piattaforma"],"Create Project":["Crea Progetto"],"The organization you were looking for was not found.":["L'organizzazione che stai cercando non è stata trovata."],"Create Organization":["Crea organizzazione"],"Create a New Organization":["Crea una nuova organizzazione"],"Organizations represent the top level in your hierarchy. You'll be able to bundle a collection of teams within an organization as well as give organization-wide permissions to users.":["Le organizzazioni rappresentano il livello più alto nella gerarchia. All'interno di un'organizzazione sarai in grado di riunire un insieme di gruppi così come di concedere le autorizzazioni a livello di organizzazione per gli utenti."],"Organization Name":["Nome organizzazione"],"Bookmark":["Segnalibro"],"The issue you were looking for was not found.":["La richiesta che stai cercando non è stata trovata."],"Enabled":["Attivato"],"Total":["Totale"],"Event Details":["Dettagli dell'evento"],"Overview":["Panoramica"],"Trends":["Tendenze"],"Full Documentation":["Documentazione completa"],"Configure your application":["Configura la tua applicazione"],"Get started by selecting the platform or language that powers your application.":["Inizia selezionando la piattaforma o la lingua che alimentano la tua applicazione."],"DSN":["DSN"],"Restore":["Riabilita"],"All Issues":["Tutte le versioni"],"First Event":["Primo evento"],"Last Event":["Ultimo evento"],"Search":["Cerca"],"Project Name":["Nome Progetto"],"14d":["14d"],"Your account has been deactivated and scheduled for removal.":["Il tuo account è stato disattivato ed è in programma per la rimozione."],"Thanks for using Sentry! We hope to see you again soon!":["Grazie per aver utilizzato Sentry! Speriamo di rivederti presto!"],"Integration":["Integrazione"],"API Keys":["Api Key"],"Edit API Key":["Modifica chiave API"],"Key":["Chiave"],"Revoke":["Revoca"],"Dashboard":["Pannello di Controllo"],"Remove Organization":["Rimuovi organizzazione"],"Member Settings":["Impostazioni di Utenti"],"Basics":["Base"],"Added":["Aggiunto"],"Generate New Invite":["Crea Nuovo Invito"],"Resend Invite":["Reinviare L'invito"],"Pending Members":["Membri in Sospeso"],"Public Key":["Chiave pubblica"],"Leave Team":["Lascia il team"],"Your Teams":["I tuoi team"],"Team Details":["Dettagli del team"],"Add Member":["Aggiungi Membro"],"Add Project":["Aggiungi Progetto"],"Remove Team":["Rimuovi Team"],"Hidden":["Nascosto"],"Generate New Key":["Crea Nuova Key"],"Secret Key":["Chiave segreta"],"Project ID":["ID progetto"],"Client Configuration":["Configurazione Client"],"Token":["Token"],"Webhook":["Webhook"],"Remove Project":["Rimuovi il progetto"],"You do not have the required permission to remove this project.":["Non hai l'autorizzazione necessaria per rimuovere questo progetto."],"This project cannot be removed. It is used internally by the Sentry server.":["Questo progetto non può essere rimosso. Viene utilizzato internamente dal server Sentry."],"Removing this project is permanent and cannot be undone!":["La rimozione del progetto è permanente e non può essere annullata!"],"Event Settings":["Impostazioni Evento"],"Client Security":["Sicurezza del Client"],"Enable Plugin":["Attiva Plugin"],"Disable Plugin":["Disattiva Plugin"],"Reset Configuration":["Reimposta Configurazione"],"Instructions":["Istruzioni"],"Artifacts":["Artefatti"],"Create a New Team":["Crea un Nuovo Team"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n != 1);","lang":"it"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/it.26d99eb231cbae29159f0a02a7e61d2a.js.map
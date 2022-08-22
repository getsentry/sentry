(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/pl"],{

/***/ "../node_modules/moment/locale/pl.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/pl.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Polish [pl]
//! author : Rafal Hirsz : https://github.com/evoL

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var monthsNominative =
            'styczeń_luty_marzec_kwiecień_maj_czerwiec_lipiec_sierpień_wrzesień_październik_listopad_grudzień'.split(
                '_'
            ),
        monthsSubjective =
            'stycznia_lutego_marca_kwietnia_maja_czerwca_lipca_sierpnia_września_października_listopada_grudnia'.split(
                '_'
            ),
        monthsParse = [
            /^sty/i,
            /^lut/i,
            /^mar/i,
            /^kwi/i,
            /^maj/i,
            /^cze/i,
            /^lip/i,
            /^sie/i,
            /^wrz/i,
            /^paź/i,
            /^lis/i,
            /^gru/i,
        ];
    function plural(n) {
        return n % 10 < 5 && n % 10 > 1 && ~~(n / 10) % 10 !== 1;
    }
    function translate(number, withoutSuffix, key) {
        var result = number + ' ';
        switch (key) {
            case 'ss':
                return result + (plural(number) ? 'sekundy' : 'sekund');
            case 'm':
                return withoutSuffix ? 'minuta' : 'minutę';
            case 'mm':
                return result + (plural(number) ? 'minuty' : 'minut');
            case 'h':
                return withoutSuffix ? 'godzina' : 'godzinę';
            case 'hh':
                return result + (plural(number) ? 'godziny' : 'godzin');
            case 'ww':
                return result + (plural(number) ? 'tygodnie' : 'tygodni');
            case 'MM':
                return result + (plural(number) ? 'miesiące' : 'miesięcy');
            case 'yy':
                return result + (plural(number) ? 'lata' : 'lat');
        }
    }

    var pl = moment.defineLocale('pl', {
        months: function (momentToFormat, format) {
            if (!momentToFormat) {
                return monthsNominative;
            } else if (/D MMMM/.test(format)) {
                return monthsSubjective[momentToFormat.month()];
            } else {
                return monthsNominative[momentToFormat.month()];
            }
        },
        monthsShort: 'sty_lut_mar_kwi_maj_cze_lip_sie_wrz_paź_lis_gru'.split('_'),
        monthsParse: monthsParse,
        longMonthsParse: monthsParse,
        shortMonthsParse: monthsParse,
        weekdays:
            'niedziela_poniedziałek_wtorek_środa_czwartek_piątek_sobota'.split('_'),
        weekdaysShort: 'ndz_pon_wt_śr_czw_pt_sob'.split('_'),
        weekdaysMin: 'Nd_Pn_Wt_Śr_Cz_Pt_So'.split('_'),
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD.MM.YYYY',
            LL: 'D MMMM YYYY',
            LLL: 'D MMMM YYYY HH:mm',
            LLLL: 'dddd, D MMMM YYYY HH:mm',
        },
        calendar: {
            sameDay: '[Dziś o] LT',
            nextDay: '[Jutro o] LT',
            nextWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[W niedzielę o] LT';

                    case 2:
                        return '[We wtorek o] LT';

                    case 3:
                        return '[W środę o] LT';

                    case 6:
                        return '[W sobotę o] LT';

                    default:
                        return '[W] dddd [o] LT';
                }
            },
            lastDay: '[Wczoraj o] LT',
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                        return '[W zeszłą niedzielę o] LT';
                    case 3:
                        return '[W zeszłą środę o] LT';
                    case 6:
                        return '[W zeszłą sobotę o] LT';
                    default:
                        return '[W zeszły] dddd [o] LT';
                }
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: 'za %s',
            past: '%s temu',
            s: 'kilka sekund',
            ss: translate,
            m: translate,
            mm: translate,
            h: translate,
            hh: translate,
            d: '1 dzień',
            dd: '%d dni',
            w: 'tydzień',
            ww: translate,
            M: 'miesiąc',
            MM: translate,
            y: 'rok',
            yy: translate,
        },
        dayOfMonthOrdinalParse: /\d{1,2}\./,
        ordinal: '%d.',
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 4, // The week that contains Jan 4th is the first week of the year.
        },
    });

    return pl;

})));


/***/ }),

/***/ "../src/sentry/locale/pl/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/pl/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Nazwa użytkownika"],"Permissions":["Uprawnienia"],"Default (let Sentry decide)":["Domyślnie (pozwól decydować Sentry)"],"Most recent call last":["Od najstarszych wywołań"],"Most recent call first":["Od najnowych wywołań"],"Info":["Informacja"],"Remove":["Usuń"],"Configure":["Konfiguruj"],"Continue":["Kontynuuj"],"Priority":["Priorytet"],"Last Seen":["Ostatnie wystąpienie"],"First Seen":["Pierwsze wystąpienie"],"Frequency":["Częstotliwość występowania"],"Score":["Wynik"],"Name":["Nazwa"],"URL":["URL"],"Project":["Projekt"],"Active":["Aktywny"],"Unresolved":["Nierozwiązane"],"Resolved":["Rozwiązane"],"Ignored":["Ignorowany"],"error":["błąd"],"Events":["Zdarzenia"],"Users":["Użytkownicy"],"name":["nazwa"],"user":["Użytkownik"],"Page Not Found":["Nie znaleziono strony"],"The page you are looking for was not found.":["Nie znaleziono poszukiwanej strony."],"Cancel":["Anuluj"],"Confirm Password":["Potwierdź hasło"],"Submit":["Wyślij"],"Next":["Następne"],"Register":["Zarejestruj"],"Save Changes":["Zapisz zmiany"],"Method":["Metoda"],"Query":["Zapytanie"],"ID:":["ID:"],"Username:":["Nazwa użytkownika:"],"m":["m"],"never":["nigdy"],"1 day":["1 dzień"],"Account":["Konto"],"username or email":["użytkownik lub email"],"Password":["Hasło"],"password":["hasło"],"Email":["Email"],"Help":["Pomoc"],"Ignore":["Ignoruj"],"Edit":["Edytuj"],"Teams":["Zespoły"],"Projects":["Projekty"],"Details":["Szczegóły"],"Exception":["Wyjątek"],"Tags":["Tagi"],"Release":["Wydanie"],"Previous":["Poprzednie"],"Collapse":["Rozwiń"],"Confirm":["Potwierdź"],"Created":["Stworzono"],"Version":["Wersja"],"Sort by":["Sortuj po"],"Change":["Zmień"],"Device":["Urządzenie"],"Operating System":["System operacyjny"],"User":["Użytkownik"],"Language":["Język"],"Status":["Status"],"Expand":["Rozwiń"],"Delete":["Usuń"],"Actions":["Akcje"],"Show more":["Pokaż więcej"],"Raw":["Źródło"],"Additional Data":["Dodatkowe dane"],"Event ID":["ID Zdarzenia"],"Level":["Poziom"],"System":["System"],"Full":["Pełny"],"Original":["Oryginalny"],"Minified":["Zminifikowany"],"App Only":["Tylko aplikacja"],"most recent call first":["od najnowszych wywołań"],"most recent call last":["od najstarszych wywołań"],"Path":["Ścieżka"],"Toggle Context":["Przełącz kontekst"],"Cookies":["Ciasteczka"],"Headers":["Nagłówki"],"Environment":["Środowisko"],"Filename":["Nazwa pliku"],"Label":["Etykieta"],"Packages":["Pakiety"],"Docs":["Dokumentacje"],"Link":["Link"],"Regression":["Regresja"],"Save":["Zapisz"],"Create Team":["Utwórz zespół"],"Back":["Wróć"],"Role":["Rola"],"Skip this step":["Pomiń ten krok"],"Email Address":["Adres email"],"Apply":["Zatwierdź"],"All":["Wszystko"],"Disable":["Wyłącz"],"Event":["Zdarzenie"],"Organization Settings":["Ustawienia organizacji"],"Project Settings":["Ustawienia projektu"],"Project Details":["Szczegóły projektu"],"Clear":["Wyczyść"],"Alerts":["Alerty"],"Stats":["Statystyki"],"Settings":["Ustawienia"],"Members":["Zespół"],"Admin":["Administrator"],"Exception Type":["Rodzaj wyjątku"],"n/a":["b/d"],"Tag Details":["Szczegóły tagu"],"Team Name":["Nazwa zespołu"],"Separate multiple entries with a newline.":["Oddziel wiele wpisów pustą linią."],"General":["Ogólne"],"Allowed Domains":["Dopuszczone domeny"],"Server":["Serwer"],"Organizations":["Organizacje"],"Queue":["Kolejka"],"Mail":["Mail"],"Notifications":["Powiadomienia"],"Identities":["Tożsamości"],"Configuration":["Konfiguracja"],"API Key":["Klucz API"],"Team":["Zespół"],"Integrations":["Integracje"],"Create a new account":["Utwórz nowe konto"],"Server Version":["Wersja serwera"],"Python Version":["Wersja Python-a"],"Configuration File":["Plik konfiguracyjny"],"Uptime":["Uptime"],"Environment not found (are you using the builtin Sentry webserver?).":["Błędne zmienne środowiskwe (czy używasz wbudowanego web-serwera Sentry?)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Wyślij wiadomość na adres email powiązany z Twoim kontem, aby sprawdzić czy wszystko jest poprawnie skonfigurowane."],"SMTP Settings":["Ustawienia SMTP"],"From Address":["Z adresu"],"Host":["Serwer"],"not set":["nie ustawione"],"No":["Nie"],"Yes":["Tak"],"Test Settings":["Testuj ustawienia"],"Extensions":["Rozszerzenia"],"Modules":["Moduły"],"Disable the account.":["Zablokuj konto."],"Permanently remove the user and their data.":["Nieodwracanie usuń użytkownika i jego dane."],"Remove User":["Usuń użytkownika"],"Designates whether this user can perform administrative functions.":["Określa czy użytkownik może wykonywać funkcje administracyjne."],"Superuser":["Superużytkownik."],"15 minutes":["15 minut"],"24 hours":["24 godziny"],"Save Rule":["Zapisz regułę"],"Member":["Członek"],"60 minutes":["60 minut"],"Edit Rule":["Zmień regułę"],"Login":["Zaloguj"],"All Events":["Wszystkie zdarzenia"],"Tag":["Tag"],"Enable":["Włącz"],"Select a platform":["Wybierz platformę"],"Create Organization":["Utwórz Organizację"],"Create a New Organization":["Utwórz nową Organizację"],"Organization Name":["Nazwa organizacji"],"Bookmark":["Zakładka"],"Enabled":["Aktywny"],"Overview":["Podsumowanie"],"Trends":["Trendy"],"Create a team":["Utwórz zespół"],"DSN":["DSN"],"Restore":["Przywróć"],"Search":["Szukaj"],"Project Name":["Nazwa projektu"],"Integration":["Integracja"],"API Keys":["Klucze API"],"Edit API Key":["Zmień klucz API"],"Key":["Klucz"],"Revoke":["Unieważnij"],"Dashboard":["Pulpit"],"Remove Organization":["Usuń organizację"],"Resend Invite":["Wyślij ponownie zaproszenie"],"Pending Members":["Oczekujące członkowstwa"],"Public Key":["Klucz publiczny"],"Your Teams":["Twój zespół"],"Team Details":["Szczegóły zespołu"],"Add Member":["Dodaj członka"],"Add Project":["Dodaj projekt"],"Remove Team":["Usuń zespół"],"Hidden":["Ukryte"],"Generate New Key":["Generuj nowy klucz"],"Secret Key":["Klucz prywatny"],"Project ID":["ID Projektu"],"Client Configuration":["Konfiguracja klienta"],"Remove Project":["Usuń projekt"],"This project cannot be removed. It is used internally by the Sentry server.":["Nie moża usunąć tego projektu, gdyż jest używany wewnętrznie przez serwer Sentry."],"Event Settings":["Ustawienia zdarzeń"],"Client Security":["Zabezpieczenia klienta"],"Enable Plugin":["Aktywuj plugin"],"Disable Plugin":["Wyłącz plugin"],"Reset Configuration":["Wyczyść konfigurację"],"Create a New Team":["Utwórz nowy zespół"],"":{"domain":"sentry","plural_forms":"nplurals=4; plural=(n==1 ? 0 : (n%10>=2 && n%10<=4) && (n%100<12 || n%100>14) ? 1 : n!=1 && (n%10>=0 && n%10<=1) || (n%10>=5 && n%10<=9) || (n%100>=12 && n%100<=14) ? 2 : 3);","lang":"pl"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/pl.cb404502f2d3936e6c578c58658916da.js.map
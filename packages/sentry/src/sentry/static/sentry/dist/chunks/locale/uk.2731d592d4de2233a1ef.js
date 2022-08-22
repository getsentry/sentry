(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/uk"],{

/***/ "../node_modules/moment/locale/uk.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/uk.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Ukrainian [uk]
//! author : zemlanin : https://github.com/zemlanin
//! Author : Menelion Elensúle : https://github.com/Oire

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    function plural(word, num) {
        var forms = word.split('_');
        return num % 10 === 1 && num % 100 !== 11
            ? forms[0]
            : num % 10 >= 2 && num % 10 <= 4 && (num % 100 < 10 || num % 100 >= 20)
            ? forms[1]
            : forms[2];
    }
    function relativeTimeWithPlural(number, withoutSuffix, key) {
        var format = {
            ss: withoutSuffix ? 'секунда_секунди_секунд' : 'секунду_секунди_секунд',
            mm: withoutSuffix ? 'хвилина_хвилини_хвилин' : 'хвилину_хвилини_хвилин',
            hh: withoutSuffix ? 'година_години_годин' : 'годину_години_годин',
            dd: 'день_дні_днів',
            MM: 'місяць_місяці_місяців',
            yy: 'рік_роки_років',
        };
        if (key === 'm') {
            return withoutSuffix ? 'хвилина' : 'хвилину';
        } else if (key === 'h') {
            return withoutSuffix ? 'година' : 'годину';
        } else {
            return number + ' ' + plural(format[key], +number);
        }
    }
    function weekdaysCaseReplace(m, format) {
        var weekdays = {
                nominative:
                    'неділя_понеділок_вівторок_середа_четвер_п’ятниця_субота'.split(
                        '_'
                    ),
                accusative:
                    'неділю_понеділок_вівторок_середу_четвер_п’ятницю_суботу'.split(
                        '_'
                    ),
                genitive:
                    'неділі_понеділка_вівторка_середи_четверга_п’ятниці_суботи'.split(
                        '_'
                    ),
            },
            nounCase;

        if (m === true) {
            return weekdays['nominative']
                .slice(1, 7)
                .concat(weekdays['nominative'].slice(0, 1));
        }
        if (!m) {
            return weekdays['nominative'];
        }

        nounCase = /(\[[ВвУу]\]) ?dddd/.test(format)
            ? 'accusative'
            : /\[?(?:минулої|наступної)? ?\] ?dddd/.test(format)
            ? 'genitive'
            : 'nominative';
        return weekdays[nounCase][m.day()];
    }
    function processHoursFunction(str) {
        return function () {
            return str + 'о' + (this.hours() === 11 ? 'б' : '') + '] LT';
        };
    }

    var uk = moment.defineLocale('uk', {
        months: {
            format: 'січня_лютого_березня_квітня_травня_червня_липня_серпня_вересня_жовтня_листопада_грудня'.split(
                '_'
            ),
            standalone:
                'січень_лютий_березень_квітень_травень_червень_липень_серпень_вересень_жовтень_листопад_грудень'.split(
                    '_'
                ),
        },
        monthsShort: 'січ_лют_бер_квіт_трав_черв_лип_серп_вер_жовт_лист_груд'.split(
            '_'
        ),
        weekdays: weekdaysCaseReplace,
        weekdaysShort: 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
        weekdaysMin: 'нд_пн_вт_ср_чт_пт_сб'.split('_'),
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD.MM.YYYY',
            LL: 'D MMMM YYYY р.',
            LLL: 'D MMMM YYYY р., HH:mm',
            LLLL: 'dddd, D MMMM YYYY р., HH:mm',
        },
        calendar: {
            sameDay: processHoursFunction('[Сьогодні '),
            nextDay: processHoursFunction('[Завтра '),
            lastDay: processHoursFunction('[Вчора '),
            nextWeek: processHoursFunction('[У] dddd ['),
            lastWeek: function () {
                switch (this.day()) {
                    case 0:
                    case 3:
                    case 5:
                    case 6:
                        return processHoursFunction('[Минулої] dddd [').call(this);
                    case 1:
                    case 2:
                    case 4:
                        return processHoursFunction('[Минулого] dddd [').call(this);
                }
            },
            sameElse: 'L',
        },
        relativeTime: {
            future: 'за %s',
            past: '%s тому',
            s: 'декілька секунд',
            ss: relativeTimeWithPlural,
            m: relativeTimeWithPlural,
            mm: relativeTimeWithPlural,
            h: 'годину',
            hh: relativeTimeWithPlural,
            d: 'день',
            dd: relativeTimeWithPlural,
            M: 'місяць',
            MM: relativeTimeWithPlural,
            y: 'рік',
            yy: relativeTimeWithPlural,
        },
        // M. E.: those two are virtually unused but a user might want to implement them for his/her website for some reason
        meridiemParse: /ночі|ранку|дня|вечора/,
        isPM: function (input) {
            return /^(дня|вечора)$/.test(input);
        },
        meridiem: function (hour, minute, isLower) {
            if (hour < 4) {
                return 'ночі';
            } else if (hour < 12) {
                return 'ранку';
            } else if (hour < 17) {
                return 'дня';
            } else {
                return 'вечора';
            }
        },
        dayOfMonthOrdinalParse: /\d{1,2}-(й|го)/,
        ordinal: function (number, period) {
            switch (period) {
                case 'M':
                case 'd':
                case 'DDD':
                case 'w':
                case 'W':
                    return number + '-й';
                case 'D':
                    return number + '-го';
                default:
                    return number;
            }
        },
        week: {
            dow: 1, // Monday is the first day of the week.
            doy: 7, // The week that contains Jan 7th is the first week of the year.
        },
    });

    return uk;

})));


/***/ }),

/***/ "../src/sentry/locale/uk/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/uk/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Ім’я користувача"],"Permissions":["Права доступу"],"Default (let Sentry decide)":["За замовчуванням (нехай Sentry вирішить)"],"Most recent call last":["Спочатку старіші виклики"],"Most recent call first":["Спочатку новіші виклики"],"Info":["Інформація"],"Remove":["Видалити"],"Continue":["Продовжити"],"Priority":["Пріоритет"],"Last Seen":["Останній раз:"],"First Seen":["Перший раз:"],"Frequency":["Частота"],"Score":["Рахунок"],"Name":["Ім’я"],"URL":["URL"],"Project":["Проект"],"Active":["Активний"],"Unresolved":["Не вирішено"],"Resolved":["Вирішено"],"error":["помилка"],"Events":["Події"],"Users":["Користувачі"],"user":["користувач"],"Page Not Found":["Сторінку не знайдено"],"The page you are looking for was not found.":["Сторінку не знайдено."],"Cancel":["Скасувати"],"Confirm Password":["Підтвердження паролю"],"Submit":["Відправити"],"Next":["Наступний"],"Register":["Зареєструватися"],"Save Changes":["Зберегти зміни"],"Method":["Метод"],"Query":["Запит"],"ID:":["ID:"],"Username:":["Ім’я користувача:"],"m":["м"],"never":["ніколи"],"1 day":["1 день"],"Account":["Аккаунт"],"Password":["Пароль"],"password":["пароль"],"Email":["Email"],"Help":["Допомога"],"Resolve":["Вирішити"],"Teams":["Команди"],"Invite Member":["Запросити Користувача"],"Projects":["Проекти"],"Issues":["Проблеми"],"Details":["Деталі"],"Exception":["Виключення"],"Tags":["Теги"],"Breadcrumbs":["Хлібні крихти"],"Previous":["Попередній"],"Confirm":["Підтвердити"],"e.g. 100":["напр. 100"],"Version":["Версія"],"Change":["Змінити"],"Operating System":["Операційна система:"],"User":["Користувач"],"Language":["Мова"],"Status":["Статус"],"Actions":["Події"],"Raw":["Рядок"],"Additional Data":["Додаткові данні"],"Event ID":["ID події"],"most recent call first":["спочатку новіші виклики"],"most recent call last":["спочатку старіші виклики"],"Path":["Шлях"],"Environment":["Оточення"],"Filename":["ім'я файлу"],"Packages":["Пакунки"],"Link":["Посилання"],"Regression":["Регресія"],"Ownership Rules":["Правила Власності"],"Create Team":["Створити команду"],"Email Address":["Адреса e-mail"],"Apply":["Застосувати"],"Project Settings":["Налаштування проекту"],"Project Details":["Деталі Проектів"],"Clear":["Очистити"],"Alerts":["Сповіщення"],"Stats":["Статистика"],"Settings":["Налаштування"],"Members":["Користувачі"],"Admin":["Адмін"],"n/a":["н/д"],"Tag Details":["Деталі Теґу"],"Team Name":["Назва команди"],"General":["Головне"],"Allowed Domains":["Дозволені домени"],"Server":["Сервер"],"Mail":["Пошта"],"Notifications":["Сповіщення"],"Identities":["Ідентифікації"],"Configuration":["Конфігурація"],"API Key":["API Ключ"],"Team":["Команда"],"Integrations":["Інтеграції"],"Create a new account":["Створити новий обліковий запис"],"Server Version":["Версія Сервера."],"Python Version":["Версія Python"],"Configuration File":["Файл конфігурації"],"Uptime":["Uptime"],"Environment not found (are you using the builtin Sentry webserver?).":["Оточення не знайдене (можливо ви використовуєте вбудований веб-сервер Sentry)."],"Send an email to your account's email address to confirm that everything is configured correctly.":["Відправити повідомлення на вашу адресу e-mail, для підтвердження того, що все налаштовано правильно."],"SMTP Settings":["Налаштування SMTP"],"From Address":["З адреси"],"Host":["Хост"],"not set":["не встановлене"],"No":["Ні"],"Yes":["Так"],"Test Settings":["Перевірити Налаштування"],"Extensions":["Втулки"],"Modules":["Модулі"],"Disable the account.":["Відключити цей обліковий запис."],"Permanently remove the user and their data.":["Видалити користувача та його дані НАЗАВЖДИ."],"Remove User":["Видалити користувача"],"15 minutes":["15 хвилин"],"24 hours":["24 години"],"60 minutes":["60 хвилин"],"Login":["Вхід"],"All Events":["Всі Події"],"Bookmark":["Додати у вибране"],"Enabled":["Увімкнено"],"Overview":["Огляд"],"Trends":["Тренди"],"Search":["Пошук"],"Project Name":["Назва проекту"],"Integration":["Інтеграція"],"API Keys":["Ключі API"],"Key":["Ключ"],"Revoke":["Анулювати"],"Dashboard":["Головна"],"Team Details":["Подробиці Команди"],"Add Member":["Додати користувача"],"Add Project":["Додати проект"],"Remove Team":["Видалити Команду"],"Hidden":["Приховане"],"Generate New Key":["Створити Новий Ключ"],"Client Configuration":["Налаштування Клієнта"],"Remove Project":["Видалити Проект"],"Event Settings":["Налаштування події"],"Client Security":["Безпека Клієнта"],"Enable Plugin":["Увімкнути плагін"],"Disable Plugin":["Вимкнути плагін"],"Reset Configuration":["Скинути налаштування"],"Create a New Team":["Створити нову команду"],"":{"domain":"sentry","plural_forms":"nplurals=4; plural=(n % 1 == 0 && n % 10 == 1 && n % 100 != 11 ? 0 : n % 1 == 0 && n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : n % 1 == 0 && (n % 10 ==0 || (n % 10 >=5 && n % 10 <=9) || (n % 100 >=11 && n % 100 <=14 )) ? 2: 3);","lang":"uk"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/uk.daed541c9e9c154e68636a3690b48fa4.js.map
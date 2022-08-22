(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/fa"],{

/***/ "../node_modules/moment/locale/fa.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/fa.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Persian [fa]
//! author : Ebrahim Byagowi : https://github.com/ebraminio

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var symbolMap = {
            1: '۱',
            2: '۲',
            3: '۳',
            4: '۴',
            5: '۵',
            6: '۶',
            7: '۷',
            8: '۸',
            9: '۹',
            0: '۰',
        },
        numberMap = {
            '۱': '1',
            '۲': '2',
            '۳': '3',
            '۴': '4',
            '۵': '5',
            '۶': '6',
            '۷': '7',
            '۸': '8',
            '۹': '9',
            '۰': '0',
        };

    var fa = moment.defineLocale('fa', {
        months: 'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split(
            '_'
        ),
        monthsShort:
            'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split(
                '_'
            ),
        weekdays:
            'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split(
                '_'
            ),
        weekdaysShort:
            'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split(
                '_'
            ),
        weekdaysMin: 'ی_د_س_چ_پ_ج_ش'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'DD/MM/YYYY',
            LL: 'D MMMM YYYY',
            LLL: 'D MMMM YYYY HH:mm',
            LLLL: 'dddd, D MMMM YYYY HH:mm',
        },
        meridiemParse: /قبل از ظهر|بعد از ظهر/,
        isPM: function (input) {
            return /بعد از ظهر/.test(input);
        },
        meridiem: function (hour, minute, isLower) {
            if (hour < 12) {
                return 'قبل از ظهر';
            } else {
                return 'بعد از ظهر';
            }
        },
        calendar: {
            sameDay: '[امروز ساعت] LT',
            nextDay: '[فردا ساعت] LT',
            nextWeek: 'dddd [ساعت] LT',
            lastDay: '[دیروز ساعت] LT',
            lastWeek: 'dddd [پیش] [ساعت] LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: 'در %s',
            past: '%s پیش',
            s: 'چند ثانیه',
            ss: '%d ثانیه',
            m: 'یک دقیقه',
            mm: '%d دقیقه',
            h: 'یک ساعت',
            hh: '%d ساعت',
            d: 'یک روز',
            dd: '%d روز',
            M: 'یک ماه',
            MM: '%d ماه',
            y: 'یک سال',
            yy: '%d سال',
        },
        preparse: function (string) {
            return string
                .replace(/[۰-۹]/g, function (match) {
                    return numberMap[match];
                })
                .replace(/،/g, ',');
        },
        postformat: function (string) {
            return string
                .replace(/\d/g, function (match) {
                    return symbolMap[match];
                })
                .replace(/,/g, '،');
        },
        dayOfMonthOrdinalParse: /\d{1,2}م/,
        ordinal: '%dم',
        week: {
            dow: 6, // Saturday is the first day of the week.
            doy: 12, // The week that contains Jan 12th is the first week of the year.
        },
    });

    return fa;

})));


/***/ }),

/***/ "../src/sentry/locale/fa/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/fa/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Permissions":["دسترسی‌ها"],"Remove":["حذف"],"Priority":["اولویت"],"Last Seen":["آخرین وقوع"],"First Seen":["اولین وقوع"],"Frequency":["بسامد"],"Score":["امتیاز"],"Name":["نام"],"URL":["URL"],"Project":["پروژه"],"error":["خطا"],"Users":["کاربران"],"user":["کاربر"],"Page Not Found":["صفحه پیدا نشد"],"The page you are looking for was not found.":["صفحه ای که دنبال آن می گردید پیدا نشد"],"Sign out":["خروج"],"Register":["ثبت‌نام"],"Save Changes":["ذخیره تغییرات"],"Account":["حساب"],"Projects":["پروژه ها"],"Details":["جزئیات"],"User":["کاربر"],"Status":["وضعیت"],"API":["API"],"Docs":["مستندات"],"Role":["نقش"],"Settings":["تنظیمات"],"Members":["اعضا"],"Admin":["ادمین"],"Configuration":["پیکربندی"],"Create a new account":["ساخت حساب جدید"],"Python Version":["نسخه پایتون"],"Extensions":["افزونه‌ها"],"Modules":["پیمانه‌ها"],"Remove User":["حذف کاربر"],"Member":["عضو"],"Login":["ورود"],"Search":["جستجو"],"Key":["کلید"],"Dashboard":["داشبورد"],"Remove Organization":["حذف سازمان"],"":{"domain":"sentry","plural_forms":"nplurals=2; plural=(n > 1);","lang":"fa"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/fa.4ed256b7fae010c4a30a8cbc176a9b22.js.map
(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/ar"],{

/***/ "../node_modules/moment/locale/ar.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/ar.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Arabic [ar]
//! author : Abdel Said: https://github.com/abdelsaid
//! author : Ahmed Elkhatib
//! author : forabi https://github.com/forabi

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var symbolMap = {
            1: '١',
            2: '٢',
            3: '٣',
            4: '٤',
            5: '٥',
            6: '٦',
            7: '٧',
            8: '٨',
            9: '٩',
            0: '٠',
        },
        numberMap = {
            '١': '1',
            '٢': '2',
            '٣': '3',
            '٤': '4',
            '٥': '5',
            '٦': '6',
            '٧': '7',
            '٨': '8',
            '٩': '9',
            '٠': '0',
        },
        pluralForm = function (n) {
            return n === 0
                ? 0
                : n === 1
                ? 1
                : n === 2
                ? 2
                : n % 100 >= 3 && n % 100 <= 10
                ? 3
                : n % 100 >= 11
                ? 4
                : 5;
        },
        plurals = {
            s: [
                'أقل من ثانية',
                'ثانية واحدة',
                ['ثانيتان', 'ثانيتين'],
                '%d ثوان',
                '%d ثانية',
                '%d ثانية',
            ],
            m: [
                'أقل من دقيقة',
                'دقيقة واحدة',
                ['دقيقتان', 'دقيقتين'],
                '%d دقائق',
                '%d دقيقة',
                '%d دقيقة',
            ],
            h: [
                'أقل من ساعة',
                'ساعة واحدة',
                ['ساعتان', 'ساعتين'],
                '%d ساعات',
                '%d ساعة',
                '%d ساعة',
            ],
            d: [
                'أقل من يوم',
                'يوم واحد',
                ['يومان', 'يومين'],
                '%d أيام',
                '%d يومًا',
                '%d يوم',
            ],
            M: [
                'أقل من شهر',
                'شهر واحد',
                ['شهران', 'شهرين'],
                '%d أشهر',
                '%d شهرا',
                '%d شهر',
            ],
            y: [
                'أقل من عام',
                'عام واحد',
                ['عامان', 'عامين'],
                '%d أعوام',
                '%d عامًا',
                '%d عام',
            ],
        },
        pluralize = function (u) {
            return function (number, withoutSuffix, string, isFuture) {
                var f = pluralForm(number),
                    str = plurals[u][pluralForm(number)];
                if (f === 2) {
                    str = str[withoutSuffix ? 0 : 1];
                }
                return str.replace(/%d/i, number);
            };
        },
        months = [
            'يناير',
            'فبراير',
            'مارس',
            'أبريل',
            'مايو',
            'يونيو',
            'يوليو',
            'أغسطس',
            'سبتمبر',
            'أكتوبر',
            'نوفمبر',
            'ديسمبر',
        ];

    var ar = moment.defineLocale('ar', {
        months: months,
        monthsShort: months,
        weekdays: 'الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'.split('_'),
        weekdaysShort: 'أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'.split('_'),
        weekdaysMin: 'ح_ن_ث_ر_خ_ج_س'.split('_'),
        weekdaysParseExact: true,
        longDateFormat: {
            LT: 'HH:mm',
            LTS: 'HH:mm:ss',
            L: 'D/\u200FM/\u200FYYYY',
            LL: 'D MMMM YYYY',
            LLL: 'D MMMM YYYY HH:mm',
            LLLL: 'dddd D MMMM YYYY HH:mm',
        },
        meridiemParse: /ص|م/,
        isPM: function (input) {
            return 'م' === input;
        },
        meridiem: function (hour, minute, isLower) {
            if (hour < 12) {
                return 'ص';
            } else {
                return 'م';
            }
        },
        calendar: {
            sameDay: '[اليوم عند الساعة] LT',
            nextDay: '[غدًا عند الساعة] LT',
            nextWeek: 'dddd [عند الساعة] LT',
            lastDay: '[أمس عند الساعة] LT',
            lastWeek: 'dddd [عند الساعة] LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: 'بعد %s',
            past: 'منذ %s',
            s: pluralize('s'),
            ss: pluralize('s'),
            m: pluralize('m'),
            mm: pluralize('m'),
            h: pluralize('h'),
            hh: pluralize('h'),
            d: pluralize('d'),
            dd: pluralize('d'),
            M: pluralize('M'),
            MM: pluralize('M'),
            y: pluralize('y'),
            yy: pluralize('y'),
        },
        preparse: function (string) {
            return string
                .replace(/[١٢٣٤٥٦٧٨٩٠]/g, function (match) {
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
        week: {
            dow: 6, // Saturday is the first day of the week.
            doy: 12, // The week that contains Jan 12th is the first week of the year.
        },
    });

    return ar;

})));


/***/ }),

/***/ "../src/sentry/locale/ar/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/ar/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["المعرف"],"Permissions":["التصاريح"],"Remove":["حذف"],"Continue":["استمرار"],"Priority":["الأولوية"],"Last Seen":["آخر مشاهدة"],"First Seen":["أول مشاهدة"],"Frequency":["التكرار"],"Score":["الدرجة"],"Name":["الاسم"],"URL":["الرابط:"],"Project":["مشروع"],"Active":["نشط"],"Unresolved":["غير محلولة"],"Resolved":["حلّت"],"error":["خطأ"],"Events":["الأحداث"],"Users":["مستخدمون"],"user":["مستخدم"],"Page Not Found":["الصفحة غير موجودة"],"The page you are looking for was not found.":["لم يتم العثور على الصفحة التي كنت تبحث عنها."],"Cancel":["إلغاء"],"Confirm Password":["تأكيد كلمة المرور"],"Submit":["إرسال"],"Next":["التالي"],"Register":["التسجيل"],"Save Changes":["حفظ التغييرات"],"ID:":["رقم تعريفي:"],"Username:":["اسم المستخدم:"],"never":["أبدًا"],"1 day":["1 يوم"],"Account":["الحساب"],"username or email":["المعرف أو الإيميل"],"Password":["كلمة المرور"],"password":["كلمة المرور"],"Email":["الإيميل"],"Teams":["الفرق"],"Invite Member":["دعوة عضو"],"Projects":["المشاريع"],"Details":["التفاصيل"],"Exception":["خطأ"],"Tags":["الوسوم"],"Release":["الإصدار"],"Previous":["السابق"],"Confirm":["تأكيد"],"Version":["النسخة"],"Device":["الجهاز"],"Operating System":["نظام التشغيل"],"User":["مستخدم"],"Language":["اللغة"],"Status":["الحالة"],"Actions":["إجراءات"],"Raw":["نئ"],"Additional Data":["بيانات اضافية"],"System":["النظام"],"Path":["المسار"],"Environment":["البيئة"],"Filename":["اسم الملف"],"Packages":["حزَّم"],"Contribute":["مساهمة"],"Create Team":["أنشأ فريقا"],"Back":["عودة"],"Skip this step":["تجاهل هذه الخطوة"],"Email Address":["البريد الإلكتروني"],"Apply":["تطبيق"],"Organization Settings":["إعدادات المنظمة"],"Project Settings":["إعدادات المشروع"],"Project Details":["تفاصيل المشروع"],"Clear":["مسح"],"Alerts":["التنبيهات"],"Stats":["ملخص الإحصاءات"],"Settings":["الإعدادات"],"Members":["الأعضاء"],"Admin":["المدير"],"Exception Type":["نوع الخطأ"],"n/a":["لا شيء"],"Team Name":["اسم الفريق"],"General":["عام"],"Open Membership":["فتح العضوية"],"Allowed Domains":["النطاقات المسموحة"],"Server":["الخادم"],"Organizations":["المنظمات"],"Notifications":["التنبيهات"],"Identities":["الهويات"],"Configuration":["إعدادات"],"API Key":["مفتاح API"],"Audit Log":["سجل التدقيق"],"Team":["الفريق"],"Create a new account":["أنشئ حسابا جديدا"],"Server Version":["نسخة الخادم"],"Python Version":["نسخة Python"],"Configuration File":["ملف الإعدادات"],"Uptime":["وقت التشغيل"],"Environment not found (are you using the builtin Sentry webserver?).":["لم يتم العثور على البيئة (هل تستخدم خادم الويب الداخلي لـ Sentry؟)."],"SMTP Settings":["إعدادت SMTP"],"From Address":["عنوان \"من\""],"Host":["المضيف"],"No":["لا"],"Yes":["نعم"],"Test Settings":["تجربة الإعدادت"],"System Overview":["نظرة عامة على النظام"],"Extensions":["ملحقات"],"Modules":["نماذج"],"Disable the account.":["عطّل هذا الحساب."],"Permanently remove the user and their data.":["أزل المستخدم وبياناته نهائيًا"],"Remove User":["حذف المستخدم"],"15 minutes":["15 دقيقة"],"24 hours":["24 ساعة"],"Member":["عضو"],"60 minutes":["60 دقيقة"],"Login":["دخول"],"All Events":["جميع الأحداث"],"Create Organization":["إنشاء منظمة"],"Organization Name":["اسم المنظمة"],"Bookmark":["Bookmark"],"Enabled":["مفعل"],"Overview":["نظرة عامة"],"Create a team":["إنشاء فريق"],"Search":["بحث"],"Project Name":["اسم المشروع"],"Integration":["التكامل"],"API Keys":["مفاتيح API"],"Key":["المفتاح"],"Dashboard":["لوحة المعلومات"],"Remove Organization":["حذف المنظمة"],"Member Settings":["إعدادات العضو"],"Resend Invite":["إعادة ارسال الدعوة"],"Team Details":["تفاصيل الفريق"],"Remove Team":["حذف الفريق"],"Generate New Key":["أنشئ مفتاحا جديدا"],"Remove Project":["حذف المشروع"],"Client Security":["أمان العميل"],"Enable Plugin":["تفعيل الإضافة"],"Disable Plugin":["تعطيل الإضافة"],"":{"domain":"sentry","plural_forms":"nplurals=6; plural=n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 && n%100<=99 ? 4 : 5;","lang":"ar"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/ar.98a2a1f3724cc8d709900a470ef3de80.js.map
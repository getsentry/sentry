(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/id"],{

/***/ "../node_modules/moment/locale/id.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/id.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Indonesian [id]
//! author : Mohammad Satrio Utomo : https://github.com/tyok
//! reference: http://id.wikisource.org/wiki/Pedoman_Umum_Ejaan_Bahasa_Indonesia_yang_Disempurnakan

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var id = moment.defineLocale('id', {
        months: 'Januari_Februari_Maret_April_Mei_Juni_Juli_Agustus_September_Oktober_November_Desember'.split(
            '_'
        ),
        monthsShort: 'Jan_Feb_Mar_Apr_Mei_Jun_Jul_Agt_Sep_Okt_Nov_Des'.split('_'),
        weekdays: 'Minggu_Senin_Selasa_Rabu_Kamis_Jumat_Sabtu'.split('_'),
        weekdaysShort: 'Min_Sen_Sel_Rab_Kam_Jum_Sab'.split('_'),
        weekdaysMin: 'Mg_Sn_Sl_Rb_Km_Jm_Sb'.split('_'),
        longDateFormat: {
            LT: 'HH.mm',
            LTS: 'HH.mm.ss',
            L: 'DD/MM/YYYY',
            LL: 'D MMMM YYYY',
            LLL: 'D MMMM YYYY [pukul] HH.mm',
            LLLL: 'dddd, D MMMM YYYY [pukul] HH.mm',
        },
        meridiemParse: /pagi|siang|sore|malam/,
        meridiemHour: function (hour, meridiem) {
            if (hour === 12) {
                hour = 0;
            }
            if (meridiem === 'pagi') {
                return hour;
            } else if (meridiem === 'siang') {
                return hour >= 11 ? hour : hour + 12;
            } else if (meridiem === 'sore' || meridiem === 'malam') {
                return hour + 12;
            }
        },
        meridiem: function (hours, minutes, isLower) {
            if (hours < 11) {
                return 'pagi';
            } else if (hours < 15) {
                return 'siang';
            } else if (hours < 19) {
                return 'sore';
            } else {
                return 'malam';
            }
        },
        calendar: {
            sameDay: '[Hari ini pukul] LT',
            nextDay: '[Besok pukul] LT',
            nextWeek: 'dddd [pukul] LT',
            lastDay: '[Kemarin pukul] LT',
            lastWeek: 'dddd [lalu pukul] LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: 'dalam %s',
            past: '%s yang lalu',
            s: 'beberapa detik',
            ss: '%d detik',
            m: 'semenit',
            mm: '%d menit',
            h: 'sejam',
            hh: '%d jam',
            d: 'sehari',
            dd: '%d hari',
            M: 'sebulan',
            MM: '%d bulan',
            y: 'setahun',
            yy: '%d tahun',
        },
        week: {
            dow: 0, // Sunday is the first day of the week.
            doy: 6, // The week that contains Jan 6th is the first week of the year.
        },
    });

    return id;

})));


/***/ }),

/***/ "../src/sentry/locale/id/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/id/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["Nama pengguna"],"Permissions":["Izin"],"Default (let Sentry decide)":["Default (ditentukan oleh Sentry)"],"Most recent call last":["Panggilan terakhir diakhir"],"Most recent call first":["Panggilan terakhir diawal"],"Info":["Info"],"Remove":["Buang"],"Configure":["Konfigurasi"],"Continue":["Lanjut"],"Priority":["Prioritas"],"Last Seen":["Terakhir Terlihat"],"First Seen":["Pertama Terlihat"],"Frequency":["Frekuensi"],"Score":["Skor"],"Project":["Proyek"],"Active":["Aktif"],"Unresolved":["Belom diselesaikan"],"Resolved":["Terselesaikan"],"Ignored":["Diabaikan"],"error":["error"],"name":["nama"],"user":["pengguna"],"Page Not Found":["Halaman Tidak Ditemui"],"The page you are looking for was not found.":["Halaman yang anda cari tidak bisa ditemukan."],"Cancel":["Batalkan"],"Confirm Password":["Konfirmasi Password"],"Help us keep your account safe by confirming your identity.":["Bantu kami menjaga akun anda selamat dengan mengkonfirmasi indentitas anda."],"Lost your password?":["Kehilangan Password Anda?"],"Next":["Lanjut"],"Resolve":["Menyelesaikan"],"Issues":["Daftar Isu"],"Tags":["Tag"],"Breadcrumbs":["Breadcrumbs"],"Ownership Rules":["Aturan Kepemilikan"],"Login":["Logi"],"":{"domain":"sentry","plural_forms":"nplurals=1; plural=0;","lang":"id"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/id.71896945a3405d69ea89f3c6123822db.js.map
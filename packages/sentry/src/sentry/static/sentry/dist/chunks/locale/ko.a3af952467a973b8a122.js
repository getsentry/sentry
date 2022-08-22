(globalThis["webpackChunk"] = globalThis["webpackChunk"] || []).push([["locale/ko"],{

/***/ "../node_modules/moment/locale/ko.js":
/*!*******************************************!*\
  !*** ../node_modules/moment/locale/ko.js ***!
  \*******************************************/
/***/ (function(__unused_webpack_module, __unused_webpack_exports, __webpack_require__) {

//! moment.js locale configuration
//! locale : Korean [ko]
//! author : Kyungwook, Park : https://github.com/kyungw00k
//! author : Jeeeyul Lee <jeeeyul@gmail.com>

;(function (global, factory) {
    true ? factory(__webpack_require__(/*! ../moment */ "../node_modules/moment/moment.js")) :
   0
}(this, (function (moment) { 'use strict';

    //! moment.js locale configuration

    var ko = moment.defineLocale('ko', {
        months: '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split('_'),
        monthsShort: '1월_2월_3월_4월_5월_6월_7월_8월_9월_10월_11월_12월'.split(
            '_'
        ),
        weekdays: '일요일_월요일_화요일_수요일_목요일_금요일_토요일'.split('_'),
        weekdaysShort: '일_월_화_수_목_금_토'.split('_'),
        weekdaysMin: '일_월_화_수_목_금_토'.split('_'),
        longDateFormat: {
            LT: 'A h:mm',
            LTS: 'A h:mm:ss',
            L: 'YYYY.MM.DD.',
            LL: 'YYYY년 MMMM D일',
            LLL: 'YYYY년 MMMM D일 A h:mm',
            LLLL: 'YYYY년 MMMM D일 dddd A h:mm',
            l: 'YYYY.MM.DD.',
            ll: 'YYYY년 MMMM D일',
            lll: 'YYYY년 MMMM D일 A h:mm',
            llll: 'YYYY년 MMMM D일 dddd A h:mm',
        },
        calendar: {
            sameDay: '오늘 LT',
            nextDay: '내일 LT',
            nextWeek: 'dddd LT',
            lastDay: '어제 LT',
            lastWeek: '지난주 dddd LT',
            sameElse: 'L',
        },
        relativeTime: {
            future: '%s 후',
            past: '%s 전',
            s: '몇 초',
            ss: '%d초',
            m: '1분',
            mm: '%d분',
            h: '한 시간',
            hh: '%d시간',
            d: '하루',
            dd: '%d일',
            M: '한 달',
            MM: '%d달',
            y: '일 년',
            yy: '%d년',
        },
        dayOfMonthOrdinalParse: /\d{1,2}(일|월|주)/,
        ordinal: function (number, period) {
            switch (period) {
                case 'd':
                case 'D':
                case 'DDD':
                    return number + '일';
                case 'M':
                    return number + '월';
                case 'w':
                case 'W':
                    return number + '주';
                default:
                    return number;
            }
        },
        meridiemParse: /오전|오후/,
        isPM: function (token) {
            return token === '오후';
        },
        meridiem: function (hour, minute, isUpper) {
            return hour < 12 ? '오전' : '오후';
        },
    });

    return ko;

})));


/***/ }),

/***/ "../src/sentry/locale/ko/LC_MESSAGES/django.po":
/*!*****************************************************!*\
  !*** ../src/sentry/locale/ko/LC_MESSAGES/django.po ***!
  \*****************************************************/
/***/ ((module) => {

module.exports = {"Username":["사용자명"],"Permissions":["권한"],"Default (let Sentry decide)":["기본 (자동으로 결정하기)"],"Most recent call last":["먼저 호출된 것 부터"],"Most recent call first":["마지막에 호출된 것 부터"],"Light":["밝은 테마"],"Dark":["어두운 테마"],"Default to system":["시스템과 동일"],"Continue":["계속"],"Priority":["우선순위"],"Last Seen":["최근발생일"],"First Seen":["최초발생일"],"Frequency":["발생빈도"],"Score":["점수"],"Name":["이름"],"URL":["URL"],"Project":["프로젝트"],"Unresolved":["미해결"],"Resolved":["해결"],"error":["에러"],"Events":["이벤트"],"Users":["사용자들"],"name":["이름"],"user":["사용자"],"Page Not Found":["페이지를 찾을 수 없음"],"Cancel":["취소"],"Confirm Password":["비밀번호 확인"],"Sign out":["로그아웃"],"Submit":["등록"],"Next":["다음"],"Sign in to continue":["로그인해서 계속"],"Register":["가입"],"Privacy Policy":["개인정보 보호 방침"],"Approve":["승인"],"Save Changes":["변경사항 저장"],"ID:":["ID:"],"Username:":["사용자명"],"never":["절대"],"Account":["계정"],"username or email":["사용자명 또는 이메일 주소"],"Password":["비밀번호"],"password":["비밀번호"],"Email":["이메일"],"Close":["닫기"],"Default Role":["기본 역할"],"Help":["도움말"],"Resolve":["해결"],"This event is resolved due to the Auto Resolve configuration for this project":["해당 이벤트는 이 프로젝트의 Auto Resolve 설정에 의해 resolve 되었습니다."],"Edit":["편집"],"Are you sure you wish to delete this comment?":["정말 댓글을 삭제하시겠습니까?"],"Save Comment":["댓글 저장"],"Post Comment":["댓글 달기"],"Markdown supported":["마크다운이 지원됨"],"Teams":["팀"],"Projects":["프로젝트"],"Issues":["이슈"],"Releases":["릴리즈"],"Tags":["태그"],"Previous":["이전"],"Collapse":["접기"],"Confirm":["확인"],"Version":["버전"],"Retry":["재시도"],"Operating System":["운영 체제"],"User":["사용자"],"Language":["언어"],"Status":["상태:"],"Expand":["펼치기"],"Hide":["감추기"],"Show":["보이기"],"Show more":["더 보기"],"Event ID":["이벤트 ID"],"System":["시스템"],"Report":["보고"],"CSP Report":["CSP 보고"],"Source Map":["소스 파일"],"Query String":["쿼리 문자열"],"Cookies":["쿠키"],"Headers":["헤더"],"Environment":["환경"],"Body":["바디"],"Packages":["패키지"],"API":["API"],"Docs":["문서"],"Contribute":["기여"],"First seen":["처음 보인 날짜"],"Last seen":["마지막으로 보인 날짜"],"Last 24 Hours":["최근 24시간"],"Last 30 Days":["최근 30일"],"There was an error loading data.":["데이터를 불러오는 중 오류가 발생했습니다."],"Create Team":["팀 생성"],"Role":["역할"],"Skip this step":["이 단계 건너뛰기"],"Email Address":["이메일 주소"],"Apply":["적용"],"Filter projects":["프로젝트 필터링"],"Disable":["비활성화"],"Request Access":["엑세스 요청"],"Project Settings":["프로젝트 설정"],"Alerts":["알림"],"Stats":["통계"],"Settings":["설정"],"Members":["멤버"],"Admin":["관리자"],"Team Name":["팀 이름"],"New Issues":["새로운 이슈"],"Last 24 hours":["최근 24시간"],"Unknown error. Please try again.":["알 수 없는 오류가 발생했습니다. 다시 시도해주세요."],"Use a 24-hour clock":["24시간제 사용"],"Open Membership":["멤버십 공개"],"Enhanced Privacy":["강화된 개인 정보 보호"],"Enable JavaScript source fetching":["JavaScript source fetching 사용"],"Mail":["메일"],"Notifications":["알림"],"Configuration":["설정"],"API Key":["API 키"],"Audit Log":["민감한 기록"],"Team":["팀"],"Create a new account":["새 계정 만들기"],"Server Version":["서버 버전"],"Python Version":["Python 버전"],"Configuration File":["설정 파일"],"Uptime":["가동 시간"],"Send an email to your account's email address to confirm that everything is configured correctly.":["모든 설정이 올바른지 확인하기 위해 계정에 설정된 이메일 주소로 메일을 전송했습니다."],"SMTP Settings":["SMTP 설정"],"From Address":["보낸 사람 주소"],"Host":["호스트명"],"No":["아니요"],"Yes":["네"],"Test Settings":["테스트 설정"],"Extensions":["확장"],"Modules":["모듈"],"Remove User":["사용자 삭제"],"The project you were looking for was not found.":["프로젝트를 찾을 수 없습니다."],"15 minutes":["15분"],"1 hour":["1 시간"],"24 hours":["24 시간"],"60 minutes":["60분"],"1 week":["1 주일"],"History":["기록"],"Login":["로그인"],"Merge":["병합"],"Add to Bookmarks":["북마크에 추가"],"Remove from Bookmarks":["북마크에서 제거"],"Set status to: Unresolved":["상태를 다음으로 변경: Unresolved"],"Graph:":["그래프:"],"24h":["24h"],"This action cannot be undone.":["이 작업은 되돌릴 수 없습니다."],"Tag":["태그"],"Enable":["활성화"],"Create Organization":["조직 만들기"],"Create a New Organization":["새로운 조직 생성"],"Organization Name":["조직 이름"],"Total":["총합"],"Create a team":["팀 만들기"],"All Issues":["모든 이슈"],"Search":["검색"],"Project Name":["프로젝트명"],"14d":["14d"],"API Keys":["API 키"],"Key":["키"],"Dashboard":["대시보드"],"Remove Organization":["조직 삭제"],"Resend Invite":["초대 재전송"],"Add Member":["구성원 추가"],"Remove Team":["팀 삭제"],"Remove Project":["프로젝트 삭제"],"You do not have the required permission to remove this project.":["이 프로젝트를 삭제할 수 있는 권한이 없습니다."],"This project cannot be removed. It is used internally by the Sentry server.":["Sentry 서버가 내부적으로 사용중인 프로젝트로 삭제가 불가능 합니다."],"Event Settings":["이벤트 설정"],"Enable Plugin":["플러그인 켜기"],"Disable Plugin":["플러그인 끄기"],"Reset Configuration":["설정 초기화"],"Create a New Team":["새로운 팀 생성"],"":{"domain":"sentry","plural_forms":"nplurals=1; plural=0;","lang":"ko"}};

/***/ })

}]);
//# sourceMappingURL=../../sourcemaps/locale/ko.3198944ca06558028f9ac3d5bf69a9fc.js.map
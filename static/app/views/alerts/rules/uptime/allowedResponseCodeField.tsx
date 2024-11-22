import {useContext} from 'react';
import type {OptionTypeBase} from 'react-select';
import {Observer} from 'mobx-react';

import SelectField, {
  type SelectFieldProps,
} from 'sentry/components/forms/fields/selectField';
import FormContext from 'sentry/components/forms/formContext';

export function AllowedResponseCodeField<OptionType extends OptionTypeBase>(
  props: SelectFieldProps<OptionType>
) {
  const formModel = useContext(FormContext).form;

  return (
    <Observer>
      {() => {
        const currentValue = formModel?.getValue<string[]>(props.name) || [];
        const maskCodes = currentValue?.filter(code => code.endsWith('xx'));
        return (
          <SelectField
            multiple
            options={httpStatusCodes}
            backspaceRemovesValue
            isOptionDisabled={option =>
              !option.value.endsWith('xx') &&
              maskCodes.some(code => option.value.charAt(0) === code.charAt(0))
            }
            {...props}
          />
        );
      }}
    </Observer>
  );
}

const httpStatusCodes = [
  {
    label: '1xx: Informational',
    options: [
      {value: '1xx', label: 'All 1xx'},
      {value: '100', label: '100 Continue'},
      {value: '101', label: '101 Switching Protocols'},
      {value: '102', label: '102 Processing'},
      {value: '103', label: '103 Early Hints'},
    ],
  },
  {
    label: '2xx: Success',
    options: [
      {value: '2xx', label: 'All 2xx'},
      {value: '200', label: '200 OK'},
      {value: '201', label: '201 Created'},
      {value: '202', label: '202 Accepted'},
      {value: '203', label: '203 Non-Authoritative Information'},
      {value: '204', label: '204 No Content'},
      {value: '205', label: '205 Reset Content'},
      {value: '206', label: '206 Partial Content'},
      {value: '207', label: '207 Multi-Status'},
      {value: '208', label: '208 Already Reported'},
      {value: '218', label: '218 This Is Fine'},
      {value: '226', label: '226 IM Used'},
    ],
  },
  {
    label: '3xx: Redirection',
    options: [
      {value: '3xx', label: 'All 3xx'},
      {value: '300', label: '300 Multiple Choices'},
      {value: '301', label: '301 Moved Permanently'},
      {value: '302', label: '302 Found'},
      {value: '303', label: '303 See Other'},
      {value: '304', label: '304 Not Modified'},
      {value: '305', label: '305 Use Proxy'},
      {value: '306', label: '306 Switch Proxy'},
      {value: '307', label: '307 Temporary Redirect'},
      {value: '308', label: '308 Permanent Redirect'},
    ],
  },
  {
    label: '4xx: Client error',
    options: [
      {value: '4xx', label: 'All 3xx'},
      {value: '400', label: '400 Bad Request'},
      {value: '401', label: '401 Unauthorized'},
      {value: '402', label: '402 Payment Required'},
      {value: '403', label: '403 Forbidden'},
      {value: '404', label: '404 Not Found'},
      {value: '405', label: '405 Method Not Allowed'},
      {value: '406', label: '406 Not Acceptable'},
      {value: '407', label: '407 Proxy Authentication Required'},
      {value: '408', label: '408 Request Timeout'},
      {value: '409', label: '409 Conflict'},
      {value: '410', label: '410 Gone'},
      {value: '411', label: '411 Length Required'},
      {value: '412', label: '412 Precondition Failed'},
      {value: '413', label: '413 Payload Too Large'},
      {value: '414', label: '414 URI Too Long'},
      {value: '415', label: '415 Unsupported Media Type'},
      {value: '416', label: '416 Range Not Satisfiable'},
      {value: '417', label: '417 Expectation Failed'},
      {value: '418', label: "418 I'm a Teapot"},
      {value: '419', label: '419 Page Expired'},
      {value: '420', label: '420 Method Failure or Enhance Your Calm'},
      {value: '421', label: '421 Misdirected Request'},
      {value: '422', label: '422 Unprocessable Entity'},
      {value: '423', label: '423 Locked'},
      {value: '424', label: '424 Failed Dependency'},
      {value: '425', label: '425 Too Early'},
      {value: '426', label: '426 Upgrade Required'},
      {value: '428', label: '428 Precondition Required'},
      {value: '429', label: '429 Too Many Requests'},
      {value: '430', label: '430 HTTP Status Code'},
      {value: '431', label: '431 Request Header Fields Too Large'},
      {value: '440', label: '440 Login Time-Out'},
      {value: '444', label: '444 No Response'},
      {value: '449', label: '449 Retry With'},
      {value: '450', label: '450 Blocked by Windows Parental Controls'},
      {value: '451', label: '451 Unavailable For Legal Reasons'},
      {value: '460', label: '460 Client Closed Connection Prematurely'},
      {value: '463', label: '463 Too Many Forwarded IP Addresses'},
      {value: '464', label: '464 Incompatible Protocol'},
      {value: '494', label: '494 Request Header Too Large'},
      {value: '495', label: '495 SSL Certificate Error'},
      {value: '496', label: '496 SSL Certificate Required'},
      {value: '497', label: '497 HTTP Request Sent to HTTPS Port'},
      {value: '498', label: '498 Invalid Token'},
      {value: '499', label: '499 Token Required or Client Closed Request'},
    ],
  },
  {
    label: '5xx: Server error',
    options: [
      {value: '5xx', label: 'All 5xx'},
      {value: '500', label: '500 Internal Server Error'},
      {value: '501', label: '501 Not Implemented'},
      {value: '502', label: '502 Bad Gateway'},
      {value: '503', label: '503 Service Unavailable'},
      {value: '504', label: '504 Gateway Timeout'},
      {value: '505', label: '505 HTTP Version Not Supported'},
      {value: '506', label: '506 Variant Also Negotiates'},
      {value: '507', label: '507 Insufficient Storage'},
      {value: '508', label: '508 Loop Detected'},
      {value: '509', label: '509 Bandwidth Limit Exceeded'},
      {value: '510', label: '510 Not Extended'},
      {value: '511', label: '511 Network Authentication Required'},
      {value: '520', label: '520 Web Server Is Returning an Unknown Error'},
      {value: '521', label: '521 Web Server Is Down'},
      {value: '522', label: '522 Connection Timed Out'},
      {value: '523', label: '523 Origin Is Unreachable'},
      {value: '524', label: '524 A Timeout Occurred'},
      {value: '525', label: '525 SSL Handshake Failed'},
      {value: '526', label: '526 Invalid SSL Certificate'},
      {value: '527', label: '527 Railgun Listener to Origin'},
      {value: '529', label: '529 The Service Is Overloaded'},
      {value: '530', label: '530 Site Frozen'},
      {value: '561', label: '561 Unauthorized'},
      {value: '598', label: '598 Network Read Timeout Error'},
      {value: '599', label: '599 Network Connect Timeout Error'},
    ],
  },
  {
    label: 'Additional status codes',
    options: [
      {value: '110', label: '110 Response Is Stale'},
      {value: '111', label: '111 Revalidation Failed'},
      {value: '112', label: '112 Disconnected Operation'},
      {value: '113', label: '113 Heuristic Expiration'},
      {value: '199', label: '199 Miscellaneous Warning'},
      {value: '214', label: '214 Transformation Applied'},
      {value: '299', label: '299 Miscellaneous Persistent Warning'},
      {value: '999', label: '999 Unauthorized'},
    ],
  },
];

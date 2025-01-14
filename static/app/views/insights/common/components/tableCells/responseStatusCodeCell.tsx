import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';
import {HTTP_RESPONSE_STATUS_CODES} from 'sentry/views/insights/http/data/definitions';

interface Props {
  code: number;
}

export function ResponseStatusCodeCell({code}: Props) {
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const explanation = HTTP_RESPONSE_STATUS_CODES[code.toString()];

  return (
    <Tooltip
      disabled={!code}
      isHoverable
      title={tct('Status Code [code] “[explanation]”', {
        code,
        explanation,
      })}
    >
      {code}
    </Tooltip>
  );
}

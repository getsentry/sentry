import {useId} from 'react';

import {Input} from 'sentry/components/core/input';
import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import type {JsonPathOp} from 'sentry/views/alerts/rules/uptime/types';

import {OpContainer} from './opCommon';

interface AssertionOpJsonPathProps {
  onChange: (op: JsonPathOp) => void;
  onRemove: () => void;
  value: JsonPathOp;
}

export function AssertionOpJsonPath({
  value,
  onChange,
  onRemove,
}: AssertionOpJsonPathProps) {
  const inputId = useId();

  return (
    <OpContainer
      label={t('JSON Path')}
      onRemove={onRemove}
      inputId={inputId}
      tooltip={tct(
        'The assertion evaluates to true if the JSON path matches. See the [link:JSON Path RFC] for more information.',
        {
          link: <ExternalLink href="https://www.rfc-editor.org/rfc/rfc9535.html" />,
        }
      )}
    >
      <Input
        id={inputId}
        value={value.value}
        onChange={e => onChange({...value, value: e.target.value})}
        placeholder="$[?(@.status == 'ok')]"
        monospace
      />
    </OpContainer>
  );
}

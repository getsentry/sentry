import {Fragment} from 'react';
import styled from '@emotion/styled';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {AggregateFilter} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {space} from 'sentry/styles/space';
import type {AggregateParameter} from 'sentry/utils/fields';

type FunctionDescriptionProps = {
  parameterIndex: number;
  token: AggregateFilter;
};

function getParameterType(param: AggregateParameter) {
  if (param.kind === 'value') {
    return param.dataType;
  }

  return 'string';
}

function getParameterLabel(param: AggregateParameter) {
  return `${param.name}${param.required ? '' : '?'}: ${getParameterType(param)}`;
}

export function FunctionDescription({token, parameterIndex}: FunctionDescriptionProps) {
  const {getFieldDefinition} = useSearchQueryBuilder();
  const fnName = getKeyName(token.key);
  const fieldDefinition = getFieldDefinition(fnName);

  if (!fieldDefinition) {
    return null;
  }

  const parameters = fieldDefinition.parameters ?? [];

  return (
    <Description>
      <Code>
        <FunctionName>
          {fnName}
          {'('}
        </FunctionName>
        {parameters.map((param, i) => (
          <Fragment key={i}>
            <span>{i > 0 && ', '}</span>
            <span>
              {i === parameterIndex ? (
                <strong data-test-id="focused-param">{getParameterLabel(param)}</strong>
              ) : (
                getParameterLabel(param)
              )}
            </span>
          </Fragment>
        ))}
        <FunctionName>{')'}</FunctionName>
      </Code>
      {fieldDefinition.desc && (
        <Fragment>
          <Separator />
          <div>{fieldDefinition.desc}</div>
        </Fragment>
      )}
    </Description>
  );
}

const Description = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: left;
`;

const Code = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Separator = styled('hr')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: ${space(1)} 0;
`;

const FunctionName = styled('span')`
  color: ${p => p.theme.subText};
`;

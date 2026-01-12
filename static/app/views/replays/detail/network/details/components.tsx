import type {ReactNode} from 'react';
import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const Indent = styled('div')`
  padding-left: ${space(1)};
  padding-right: ${space(1)};
`;

export const InspectorMargin = styled('div')`
  padding: ${space(1)};
`;

const NotFoundText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
`;

const WarningText = styled('span')`
  color: ${p => p.theme.tokens.content.danger};
`;

export function Warning({warnings}: {warnings: string[]}) {
  if (warnings.includes('JSON_TRUNCATED') || warnings.includes('TEXT_TRUNCATED')) {
    return (
      <WarningText>{t('Truncated (~~) due to exceeding 150k characters')}</WarningText>
    );
  }

  if (warnings.includes('INVALID_JSON')) {
    return <WarningText>{t('Invalid JSON')}</WarningText>;
  }

  return null;
}

export function SizeTooltip({children}: {children: ReactNode}) {
  return (
    <Tooltip
      title={t('It is possible the network transfer size is smaller due to compression.')}
    >
      {children}
    </Tooltip>
  );
}

export type KeyValueTuple = {
  key: string;
  value: string | ReactNode;
  type?: 'warning' | 'error';
};

export function keyValueTableOrNotFound(data: KeyValueTuple[], notFoundText: string) {
  return data.length ? (
    <StyledKeyValueTable noMargin>
      {data.map(({key, value, type}) => (
        <KeyValueTableRow
          key={key}
          keyName={key}
          type={type}
          value={<ValueContainer>{value}</ValueContainer>}
        />
      ))}
    </StyledKeyValueTable>
  ) : (
    <Indent>
      <NotFoundText>{notFoundText}</NotFoundText>
    </Indent>
  );
}

const ValueContainer = styled('span')`
  overflow: auto;
`;

const SectionTitle = styled('dt')``;

const SectionTitleExtra = styled('span')`
  flex-grow: 1;
  text-align: right;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const SectionData = styled('dd')`
  font-size: ${p => p.theme.fontSize.xs};
`;

const ToggleButton = styled('button')`
  background: ${p => p.theme.tokens.background.primary};
  border: 0;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: ${p => p.theme.text.lineHeightBody};

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${space(1)};

  padding: ${space(0.5)} ${space(1)};

  :hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

export function SectionItem({
  children,
  title,
  titleExtra,
}: {
  children: ReactNode;
  title: ReactNode;
  titleExtra?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Fragment>
      <SectionTitle>
        <ToggleButton aria-label={t('toggle section')} onClick={() => setIsOpen(!isOpen)}>
          <IconChevron direction={isOpen ? 'down' : 'right'} size="xs" />
          {title}
          {titleExtra ? <SectionTitleExtra>{titleExtra}</SectionTitleExtra> : null}
        </ToggleButton>
      </SectionTitle>
      <SectionData>{isOpen ? children : null}</SectionData>
    </Fragment>
  );
}

const StyledKeyValueTable = styled(KeyValueTable)`
  & > dt {
    font-size: ${p => p.theme.fontSize.sm};
    padding-left: ${space(4)};
  }
  & > dd {
    ${p => p.theme.overflowEllipsis};
    font-size: ${p => p.theme.fontSize.sm};
    display: flex;
    justify-content: flex-end;
    white-space: normal;
    text-align: right;
  }
`;

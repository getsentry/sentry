import {Fragment, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const Indent = styled('div')`
  padding-left: ${space(4)};
`;

const NotFoundText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

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
  overflow: scroll;
`;

const SectionTitle = styled('dt')``;

const SectionTitleExtra = styled('span')`
  flex-grow: 1;
  text-align: right;
  font-weight: normal;
`;

const SectionData = styled('dd')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const ToggleButton = styled('button')`
  background: ${p => p.theme.background};
  border: 0;
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
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
    font-size: ${p => p.theme.fontSizeSmall};
    padding-left: ${space(4)};
  }
  & > dd {
    ${p => p.theme.overflowEllipsis};
    font-size: ${p => p.theme.fontSizeSmall};
    display: flex;
    justify-content: flex-end;
    white-space: normal;
    text-align: right;
  }
`;

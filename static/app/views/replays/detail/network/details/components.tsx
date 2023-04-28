import {Fragment, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import ObjectInspector from 'sentry/components/objectInspector';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const Indent = styled('div')`
  padding-left: ${space(4)};
`;

const NotFoundText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export function objectInspectorOrNotFound(data: any, notFoundText: string) {
  return data ? (
    <Indent>
      <ObjectInspector data={data} expandLevel={3} />
    </Indent>
  ) : (
    <Indent>
      <NotFoundText>{notFoundText}</NotFoundText>
    </Indent>
  );
}

export function keyValueTablOrNotFound(
  data: Record<string, string>,
  notFoundText: string
) {
  return data ? (
    <StyledKeyValueTable noMargin>
      {Object.entries(data).map(([key, value]) => (
        <KeyValueTableRow key={key} keyName={key} value={<span>{value}</span>} />
      ))}
    </StyledKeyValueTable>
  ) : (
    <Indent>
      <NotFoundText>{notFoundText}</NotFoundText>
    </Indent>
  );
}

const SectionTitle = styled('dt')``;

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
  gap: ${space(0.75)};

  padding: ${space(0.5)} ${space(1.5)};

  :hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

export function SectionItem({children, title}: {children: ReactNode; title: string}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Fragment>
      <SectionTitle>
        <ToggleButton aria-label={t('toggle section')} onClick={() => setIsOpen(!isOpen)}>
          <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
          {title}
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
  }
`;

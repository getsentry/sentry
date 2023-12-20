import {Fragment} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Radio from 'sentry/components/radio';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getConfigureIntegrationsDocsLink} from 'sentry/utils/docs';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {NoDataMessage} from 'sentry/views/performance/database/noDataMessage';
import {getIsMultiProject} from 'sentry/views/performance/utils';

type Props = {
  items: (() => React.ReactNode)[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  radioColor?: string;
};

export default function SelectableList(props: Props) {
  return (
    <div>
      {props.items.map((item, index) => (
        <SelectableItem
          {...props}
          isSelected={index === props.selectedIndex}
          currentIndex={index}
          key={index}
        >
          {item()}
        </SelectableItem>
      ))}
    </div>
  );
}

function SelectableItem({
  isSelected,
  currentIndex: index,
  children,
  setSelectedIndex,
  radioColor,
}: {children: React.ReactNode; currentIndex: number; isSelected: boolean} & Props) {
  return (
    <ListItemContainer>
      <ItemRadioContainer color={radioColor ?? ''}>
        <RadioLineItem index={index} role="radio">
          <Radio checked={isSelected} onChange={() => setSelectedIndex(index)} />
        </RadioLineItem>
      </ItemRadioContainer>
      {children}
    </ListItemContainer>
  );
}

export const RightAlignedCell = styled('div')`
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 ${space(1)};
`;

export const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  display: inline-block;
`;

export const GrowLink = styled(Link)`
  flex-grow: 1;
  display: inherit;
`;

export function WidgetEmptyStateWarning() {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        {t(
          'Transactions may not be listed due to the filters above or a low sampling rate'
        )}
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function TimeSpentInDatabaseWidgetEmptyStateWarning() {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        <NoDataMessage Wrapper={Fragment} isDataAvailable={false} />
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function WidgetAddInstrumentationWarning({type}: {type: 'db' | 'http'}) {
  const pageFilters = usePageFilters();
  const fullProjects = useProjects();

  const projects = pageFilters.selection.projects;

  const isMultiProject = getIsMultiProject(projects);

  if (isMultiProject) {
    return <WidgetEmptyStateWarning />;
  }

  const project = fullProjects.projects.find(p => p.id === '' + projects[0]);
  const url = getConfigureIntegrationsDocsLink(project);

  if (!url) {
    return <WidgetEmptyStateWarning />;
  }

  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        {tct(
          'No transactions with [spanCategory] spans found, you may need to [added].',
          {
            spanCategory: type === 'db' ? t('Database') : t('HTTP'),
            added: <ExternalLink href={url}>{t('add integrations')}</ExternalLink>,
          }
        )}
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function ListClose(props: {
  onClick: () => void;
  setSelectListIndex: (n: number) => void;
}) {
  return (
    <StyledTooltip title={t('Exclude this transaction from the search filter.')}>
      <StyledIconClose
        onClick={() => {
          props.onClick();
          props.setSelectListIndex(0);
        }}
      />
    </StyledTooltip>
  );
}

const StyledTooltip = styled(Tooltip)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  color: ${p => p.theme.gray200};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  justify-content: center;
  display: flex;
  align-items: center;
  flex-direction: column;
  flex: 1;
  padding: ${space(1)} ${space(2)} ${space(4)} ${space(2)};

  svg {
    margin-bottom: ${space(1)};
    height: 30px;
    width: 30px;
  }
`;

const PrimaryMessage = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  font-weight: 600;
  margin: 0 auto ${space(1)};
`;

const SecondaryMessage = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  max-width: 300px;
`;

const ListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ItemRadioContainer = styled('div')`
  grid-row: 1/3;
  input {
    cursor: pointer;
  }
  input:checked::after {
    background-color: ${p => p.color};
  }
`;

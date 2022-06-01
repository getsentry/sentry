import {Fragment} from 'react';
import styled from '@emotion/styled';

import BulkController from 'sentry/components/bulkController';
import Switch from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {LegacyBrowser} from 'sentry/types/sampling';

import {LEGACY_BROWSER_LIST} from '../utils';

const legacyBrowsers = Object.values(LegacyBrowser) as Array<LegacyBrowser>;

type Props = {
  onChange: (selectedLegacyBrowsers: Array<LegacyBrowser>) => void;
  selectedLegacyBrowsers?: Array<LegacyBrowser>;
};

function LegacyBrowsers({onChange, selectedLegacyBrowsers = []}: Props) {
  function handleChange({
    selectedIds,
  }: Parameters<NonNullable<BulkController['props']['onChange']>>[0]) {
    onChange(selectedIds as Array<LegacyBrowser>);
  }

  return (
    <BulkController
      pageIds={legacyBrowsers}
      defaultSelectedIds={selectedLegacyBrowsers}
      allRowsCount={legacyBrowsers.length}
      onChange={handleChange}
      columnsCount={0}
    >
      {({selectedIds, onRowToggle, onPageRowsToggle, isPageSelected}) => (
        <Wrapper>
          {t('All browsers')}
          <Switch
            key="switch"
            size="lg"
            isActive={isPageSelected}
            toggle={() => {
              onPageRowsToggle(!isPageSelected);
            }}
          />
          {legacyBrowsers.map(legacyBrowser => {
            const {icon, title} = LEGACY_BROWSER_LIST[legacyBrowser];
            return (
              <Fragment key={legacyBrowser}>
                <BrowserWrapper>
                  <Icon className={`icon-${icon}`} data-test-id={`icon-${icon}`} />
                  {title}
                </BrowserWrapper>
                <Switch
                  size="lg"
                  isActive={selectedIds.includes(legacyBrowser)}
                  toggle={() => onRowToggle(legacyBrowser)}
                />
              </Fragment>
            );
          })}
        </Wrapper>
      )}
    </BulkController>
  );
}

export default LegacyBrowsers;

const Wrapper = styled('div')`
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray400};
  padding-top: ${space(2)};
  padding-bottom: ${space(1)};
`;

const BrowserWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(1)};
  color: ${p => p.theme.gray500};
`;

const Icon = styled('div')`
  width: 24px;
  height: 24px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 24px 24px;
  flex-shrink: 0;
`;

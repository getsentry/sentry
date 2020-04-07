import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import {PanelHeader} from 'app/components/panels';

import DataPrivacyRulesEventIdField from './dataPrivacyRulesEventIdField';

type Props = React.ComponentProps<typeof DataPrivacyRulesEventIdField>;

const DataprivacyRulesPanelHeader = (props: Props) => (
  <StyledPanelHeader hasButtons>
    <div>{t('Data Privacy Rules')}</div>
    <DataPrivacyRulesEventIdField {...props} />
  </StyledPanelHeader>
);

export default DataprivacyRulesPanelHeader;

const StyledPanelHeader = styled(PanelHeader)`
  display: grid;
  grid-template-columns: 1fr 300px;
  grid-gap: ${space(1)};
`;

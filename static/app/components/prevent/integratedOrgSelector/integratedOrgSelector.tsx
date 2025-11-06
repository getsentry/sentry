import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex, Grid} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import DropdownButton from 'sentry/components/dropdownButton';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {integratedOrgIdToName} from 'sentry/components/prevent/utils';
import {IconAdd, IconBuilding, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useGetActiveIntegratedOrgs} from 'sentry/views/prevent/tests/queries/useGetActiveIntegratedOrgs';

const DEFAULT_ORG_LABEL = 'Select GitHub Org';

function OrgFooterMessage() {
  return (
    <Flex gap="sm" direction="column" align="start">
      <Grid columns="max-content 1fr" gap="sm">
        {props => (
          <Text variant="muted" size="sm" {...props}>
            <IconInfo size="sm" />
            <div>
              {tct(
                'Installing the [githubAppLink:GitHub Application] will require admin approval.',
                {
                  githubAppLink: (
                    <ExternalLink openInNewTab href="https://github.com/apps/sentry" />
                  ),
                }
              )}
            </div>
          </Text>
        )}
      </Grid>
      <LinkButton
        href="https://github.com/apps/sentry/installations/select_target"
        size="xs"
        icon={<IconAdd />}
        external
      >
        {t('GitHub Organization')}
      </LinkButton>
    </Flex>
  );
}

export function IntegratedOrgSelector() {
  const {integratedOrgId, integratedOrgName, preventPeriod, changeContextValue} =
    usePreventContext();
  const organization = useOrganization();

  const {data: integrations = []} = useGetActiveIntegratedOrgs({organization});

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({
        preventPeriod,
        integratedOrgId: selectedOption.value,
        integratedOrgName: selectedOption.textValue,
      });
    },
    [changeContextValue, preventPeriod]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const optionSet = new Set<string>([
      ...(integratedOrgId ? [integratedOrgId] : []),
      ...(integrations.length > 0 ? integrations.map(item => item.id) : []),
    ]);

    const makeOption = (value: string): SelectOption<string> => {
      const integratedOrgNameFromId = integratedOrgIdToName(value, integrations);
      return {
        value,
        label: <OptionLabel>{integratedOrgNameFromId ?? DEFAULT_ORG_LABEL}</OptionLabel>,
        textValue: integratedOrgNameFromId ?? DEFAULT_ORG_LABEL,
      };
    };

    return [...optionSet].map(makeOption);
  }, [integratedOrgId, integrations]);

  return (
    <CompactSelect
      options={options}
      value={integratedOrgId ?? ''}
      onChange={handleChange}
      closeOnSelect
      trigger={(triggerProps, isOpen) => {
        return (
          <DropdownButton
            isOpen={isOpen}
            icon={<IconBuilding />}
            data-test-id="page-filter-integrated-org-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <TriggerLabel>{integratedOrgName ?? DEFAULT_ORG_LABEL}</TriggerLabel>
            </TriggerLabelWrap>
          </DropdownButton>
        );
      }}
      menuWidth="280px"
      menuFooter={<OrgFooterMessage />}
    />
  );
}

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
  max-width: 200px;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  white-space: normal;
  /* Remove custom margin added by SelectorItemLabel. Once we update custom hooks and
  remove SelectorItemLabel, we can delete this. */
  div {
    margin: 0;
  }
`;

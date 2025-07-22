import {Fragment, useCallback, useMemo} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {integratedOrgIdToName} from 'sentry/components/codecov/integratedOrgSelector/utils';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconAdd, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Integration} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {IconIntegratedOrg} from './iconIntegratedOrg';

function AddIntegratedOrgButton() {
  return (
    <LinkButton
      href="https://github.com/apps/sentry-io"
      size="sm"
      icon={<IconAdd size="sm" />}
      priority="default"
    >
      {t('Integrated Organization')}
    </LinkButton>
  );
}

function OrgFooterMessage() {
  return (
    <Fragment>
      <AddIntegratedOrgButton />
      <MenuFooterDivider />
      <Flex justify="flex-start" gap="md">
        <IconInfo size="sm" style={{margin: '2px 0'}} />
        <div>
          <FooterInfoHeading>
            To access <Link to="placeholder">Integrated Organization</Link>
          </FooterInfoHeading>
          <FooterInfoSubheading>
            Ensure you log in to the same <Link to="placeholder">GitHub identity</Link>
          </FooterInfoSubheading>
        </div>
      </Flex>
    </Fragment>
  );
}

export function IntegratedOrgSelector() {
  const {integratedOrgId, changeContextValue} = useCodecovContext();
  const organization = useOrganization();

  const {data: integrations = []} = useApiQuery<Integration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {staleTime: 0}
  );

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({integratedOrgId: selectedOption.value});
    },
    [changeContextValue]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const optionSet = new Set<string>([
      ...(integratedOrgId ? [integratedOrgId] : []),
      ...(integrations.length > 0 ? integrations.map(item => item.id) : []),
    ]);

    const makeOption = (value: string): SelectOption<string> => {
      const integratedOrgName = integratedOrgIdToName(value, integrations);
      return {
        value,
        label: <OptionLabel>{integratedOrgName}</OptionLabel>,
        textValue: integratedOrgName,
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
            data-test-id="page-filter-integrated-org-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <Flex justify="flex-start" gap="sm" align="center">
                <IconContainer>
                  <IconIntegratedOrg />
                </IconContainer>
                <TriggerLabel>
                  {integratedOrgIdToName(integratedOrgId, integrations) ||
                    t('Select integrated organization')}
                </TriggerLabel>
              </Flex>
            </TriggerLabelWrap>
          </DropdownButton>
        );
      }}
      menuWidth={'22em'}
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

const FooterInfoHeading = styled('p')`
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.4;
  margin: 0;
`;

const FooterInfoSubheading = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.2;
  margin: 0;
`;

const MenuFooterDivider = styled('div')`
  position: relative;
  padding: ${space(1)} 0;
  &:before {
    display: block;
    white-space: normal;
    position: absolute;
    content: '';
    height: 1px;
    left: 0;
    right: 0;
    background: ${p => p.theme.border};
  }
`;

const IconContainer = styled('div')`
  flex: 1 0 14px;
  height: 14px;
`;

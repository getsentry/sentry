import {Fragment, useCallback, useMemo} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import type {SelectOption, SingleSelectProps} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconAdd, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export interface IntegratedOrgSelectorProps
  extends Omit<
    SingleSelectProps<string>,
    | 'multiple'
    | 'searchable'
    | 'disableSearchFilter'
    | 'hideOptions'
    | 'value'
    | 'defaultValue'
    | 'onChange'
    | 'onInteractOutside'
    | 'closeOnSelect'
    | 'onKeyDown'
    | 'options'
  > {
  /**
   * Message to show in the menu footer
   */
  chosenOrg?: string | null;
  menuFooterMessage?: React.ReactNode;
  onChange?: (data: string) => void;
}

const SAMPLE_ORG_ITEMS = ['codecov', 'sentry', 'my-other-org-with-a-super-long-name'];

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
    <div>
      <AddIntegratedOrgButton />
      <MenuFooterDivider />
      <FlexContainer>
        <IconInfo size="sm" style={{margin: '2px 0'}} />
        <div>
          <FooterInfoHeading>
            To access <Link to="placeholder">Integrated Organization</Link>
          </FooterInfoHeading>
          <FooterInfoSubheading>
            Ensure you log in to the same <Link to="placeholder">GitHub identity</Link>
          </FooterInfoSubheading>
        </div>
      </FlexContainer>
    </div>
  );
}

export function IntegratedOrgSelector({
  onChange,
  onClose,
  trigger,
  menuBody,
  menuFooter,
  menuFooterMessage,
  chosenOrg,
  ...selectProps
}: IntegratedOrgSelectorProps) {
  const options = useMemo((): Array<SelectOption<string>> => {
    const optionSet = new Set<string>([
      ...(chosenOrg ? [chosenOrg] : []),
      ...(SAMPLE_ORG_ITEMS.length ? SAMPLE_ORG_ITEMS : []),
    ]);

    const makeOption = (value: string): SelectOption<string> => {
      return {
        value,
        label: <OptionLabel>{value}</OptionLabel>,
        textValue: value,
      };
    };

    return [...optionSet].map(makeOption);
  }, [chosenOrg]);

  const handleChange = useCallback<NonNullable<SingleSelectProps<string>['onChange']>>(
    newOrg => {
      onChange?.(newOrg.value);
    },
    [onChange]
  );

  return (
    <CompactSelect
      {...selectProps}
      options={options}
      value={chosenOrg ?? ''}
      onChange={handleChange}
      onClose={onClose}
      closeOnSelect
      trigger={
        trigger ??
        ((triggerProps, isOpen) => {
          return (
            <DropdownButton
              isOpen={isOpen}
              size={selectProps.size}
              data-test-id="page-filter-integrated-org-selector"
              {...triggerProps}
              {...selectProps.triggerProps}
            >
              <TriggerLabelWrap>
                <TriggerLabel>
                  {chosenOrg || t('Select integrated organization')}
                </TriggerLabel>
              </TriggerLabelWrap>
            </DropdownButton>
          );
        })
      }
      menuWidth={'22em'}
      menuBody={menuBody}
      menuFooter={
        menuFooter || menuFooterMessage ? (
          () => {
            return (
              <Fragment>
                {menuFooterMessage && <FooterMessage>{menuFooterMessage}</FooterMessage>}
                <FooterWrap>
                  <FooterInnerWrap>{menuFooter as React.ReactNode}</FooterInnerWrap>
                </FooterWrap>
              </Fragment>
            );
          }
        ) : (
          <OrgFooterMessage />
        )
      }
    />
  );
}

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  /* Remove custom margin added by SelectorItemLabel. Once we update custom hooks and
  remove SelectorItemLabel, we can delete this. */
  div {
    margin: 0;
  }
`;

const FooterMessage = styled('p')`
  padding: ${space(0.75)} ${space(1)};
  margin: ${space(0.5)} 0;
  border-radius: ${p => p.theme.borderRadius};
  border: solid 1px ${p => p.theme.alert.warning.border};
  background: ${p => p.theme.alert.warning.backgroundLight};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const FooterInfoHeading = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.4;
  margin: 0;
`;

const FooterInfoSubheading = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1.2;
  margin: 0;
`;

const FooterWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};

  /* If there's FooterMessage above */
  &:not(:first-child) {
    margin-top: ${space(1)};
  }
`;

const FooterInnerWrap = styled('div')`
  grid-row: -1;
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};

  &:empty {
    display: none;
  }

  &:last-of-type {
    justify-self: end;
    justify-items: end;
  }
  &:first-of-type,
  &:only-child {
    justify-self: start;
    justify-items: start;
  }
`;

const MenuFooterDivider = styled('div')`
  position: relative;
  padding: ${space(1)} 0;
  &:before {
    display: block;
    position: absolute;
    content: '';
    height: 1px;
    left: 0;
    right: 0;
    background: ${p => p.theme.border};
  }
`;

const FlexContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  gap: ${space(1)};
`;

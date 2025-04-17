import {Fragment, useCallback} from 'react';
import {Link} from 'react-router-dom';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button';
import type {SelectOption, SingleSelectProps} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import type {Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import {IconAdd, IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export type ChangeData = {
  integratedOrg: string | null;
};

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
    // TODO: Remove this once we have a real options prop
    | 'options'
  > {
  /**
   * Message to show in the menu footer
   */
  menuFooterMessage?: React.ReactNode;
  onChange?: (data: ChangeData) => void;
}

const SAMPLE_ORG_ITEMS: Item[] = [
  {
    value: 'codecov',
    label: 'codecov',
    textValue: 'codecov',
    index: 0,
  },
  {
    value: 'sentry',
    label: 'sentry',
    textValue: 'sentry',
    index: 1,
  },
];

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
            Ensure you login to the same <Link to="placeholder">GitHub identity</Link>
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
  menuWidth,
  menuBody,
  menuFooter,
  menuFooterMessage,
  ...selectProps
}: IntegratedOrgSelectorProps) {
  const getOptions = useCallback((items: Item[]): Array<SelectOption<string>> => {
    const makeOption = (item: Item): SelectOption<string> => {
      return {
        value: item.value,
        label: <OptionLabel>{item.label}</OptionLabel>,
        textValue: item.searchKey,
      };
    };

    return items.map(makeOption);
  }, []);

  const handleChange = useCallback<NonNullable<SingleSelectProps<string>['onChange']>>(
    option => {
      onChange?.({relative: option.value, start: undefined, end: undefined});
    },
    [onChange]
  );

  return (
    <CompactSelect
      {...selectProps}
      options={getOptions(SAMPLE_ORG_ITEMS)}
      // TODO: change this to the selected value from the url or localStorage
      value="codecov"
      onChange={handleChange}
      closeOnSelect
      onClose={() => {
        onClose?.();
      }}
      trigger={
        trigger ??
        ((triggerProps, isOpen) => {
          return (
            <DropdownButton
              isOpen={isOpen}
              size={selectProps.size}
              data-test-id="page-filter-timerange-selector"
              {...triggerProps}
              {...selectProps.triggerProps}
            >
              <TriggerLabelWrap>
                {/* TODO: change this to the selected value from the url or localStorage */}
                <TriggerLabel>{selectProps.triggerLabel}</TriggerLabel>
              </TriggerLabelWrap>
            </DropdownButton>
          );
        })
      }
      menuWidth={menuWidth ?? '20rem'}
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
  box-shadow: 0 -1px 0 ${p => p.theme.translucentInnerBorder};
  padding: ${space(1)} ${space(1.5)};
  z-index: 2;
  margin-top: ${space(1)};
`;

const FlexContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  gap: ${space(1)};
`;

import {components as selectComponents} from 'react-select';
import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconCheckmark} from 'sentry/icons';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

type Props = React.ComponentProps<typeof selectComponents.Option>;

function SelectOption(props: Props) {
  const {label, data, selectProps, isMulti, isSelected, isFocused, isDisabled} = props;
  const {showDividers, verticallyCenterCheckWrap} = selectProps;
  const {
    value,
    details,
    tooltip,
    tooltipOptions = {delay: 500},
    leadingItems,
    trailingItems,
    leadingItemsSpanFullHeight,
    trailingItemsSpanFullHeight,
    selectionMode,
  } = data;

  const isMultiple = defined(selectionMode) ? selectionMode === 'multiple' : isMulti;

  return (
    <selectComponents.Option className="select-option" {...props}>
      <Tooltip skipWrapper title={tooltip} {...tooltipOptions}>
        <InnerWrap isFocused={isFocused} isDisabled={isDisabled} data-test-id={value}>
          <Indent isMultiple={isMultiple} centerCheckWrap={verticallyCenterCheckWrap}>
            <CheckWrap isMultiple={isMultiple} isSelected={isSelected}>
              {isSelected && (
                <IconCheckmark
                  size={isMultiple ? 'xs' : 'sm'}
                  color={isMultiple ? 'white' : undefined}
                />
              )}
            </CheckWrap>
          </Indent>
          <ContentWrap
            isFocused={isFocused}
            showDividers={showDividers}
            addRightMargin={defined(trailingItems)}
          >
            {leadingItems && (
              <LeadingItems spanFullHeight={leadingItemsSpanFullHeight}>
                {leadingItems}
              </LeadingItems>
            )}
            <LabelWrap>
              <Label as={typeof label === 'string' ? 'p' : 'div'}>{label}</Label>
              {details && <Details>{details}</Details>}
            </LabelWrap>
            {trailingItems && (
              <TrailingItems spanFullHeight={trailingItemsSpanFullHeight}>
                {trailingItems}
              </TrailingItems>
            )}
          </ContentWrap>
        </InnerWrap>
      </Tooltip>
    </selectComponents.Option>
  );
}

export default SelectOption;

const InnerWrap = styled('div')<{isDisabled: boolean; isFocused: boolean}>`
  display: flex;
  padding: 0 ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  box-sizing: border-box;

  ${p => p.isFocused && `background: ${p.theme.hover};`}
  ${p =>
    p.isDisabled &&
    `
    color: ${p.theme.subText};
    cursor: not-allowed;
  `}
`;

const Indent = styled('div')<{centerCheckWrap?: boolean; isMultiple?: boolean}>`
  display: flex;
  justify-content: center;
  gap: ${space(1)};
  padding: ${space(1)};
  padding-left: ${space(0.5)};

  ${p => p.isMultiple && !p.centerCheckWrap && `margin-top: 0.2em;`}
  ${p => p.centerCheckWrap && 'align-items: center;'}
`;

const CheckWrap = styled('div')<{isMultiple: boolean; isSelected: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;

  ${p =>
    p.isMultiple
      ? `
      width: 1em;
      height: 1em;
      padding: 1px;
      border: solid 1px ${p.theme.border};
      background: ${p.theme.backgroundElevated};
      border-radius: 2px;
      box-shadow: inset ${p.theme.dropShadowLight};
      ${
        p.isSelected &&
        `
        background: ${p.theme.purple300};
        border-color: ${p.theme.purple300};
       `
      }
    `
      : `
      width: 1em;
      height: 1.4em;
      padding-bottom: 1px;
    `}
`;

const ContentWrap = styled('div')<{
  addRightMargin: boolean;
  isFocused: boolean;
  showDividers?: boolean;
}>`
  position: relative;
  width: 100%;
  display: flex;
  gap: ${space(1)};
  justify-content: space-between;
  padding: ${space(1)} 0;
  min-width: 0;

  ${p =>
    p.addRightMargin &&
    `
    margin-right: ${space(1)};
    width: calc(100% - ${space(2)});
  `}

  ${p =>
    p.showDividers &&
    !p.isFocused &&
    `
      z-index: -1;
      box-shadow: 0 1px 0 0 ${p.theme.innerBorder};

      .select-option:last-of-type & {
        box-shadow: none;
      }
    `}
`;

const LeadingItems = styled('div')<{spanFullHeight?: boolean}>`
  display: flex;
  align-items: center;
  height: ${p => (p.spanFullHeight ? '100%' : '1.4em')};
  gap: ${space(1)};
`;

const LabelWrap = styled('div')`
  padding-right: ${space(1)};
  width: 100%;
  min-width: 0;
`;

const Label = styled('p')`
  margin-bottom: 0;
  line-height: 1.4;
  white-space: nowrap;
  ${p => p.theme.overflowEllipsis}
`;

const Details = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  line-height: 1.2;
  margin-bottom: 0;
`;

const TrailingItems = styled('div')<{spanFullHeight?: boolean}>`
  display: flex;
  align-items: center;
  height: ${p => (p.spanFullHeight ? '100%' : '1.4em')};
  gap: ${space(1)};
  margin-right: ${space(0.5)};
`;

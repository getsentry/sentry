import {components as selectComponents} from 'react-select';
import styled from '@emotion/styled';

import {IconCheckmark} from 'sentry/icons';
import space from 'sentry/styles/space';
import {defined} from 'sentry/utils';

type Props = React.ComponentProps<typeof selectComponents.Option>;

function SelectOption(props: Props) {
  const {label, data, selectProps, isMulti, isSelected, isFocused, isDisabled} = props;
  const {showDividers, verticallyCenterCheckWrap} = selectProps;
  const {
    details,
    leadingItems,
    trailingItems,
    leadingItemsSpanFullHeight,
    trailingItemsSpanFullHeight,
  } = data;

  return (
    <selectComponents.Option {...props} className="select-option">
      <InnerWrap isFocused={isFocused} isDisabled={isDisabled}>
        <Indent isMulti={isMulti} centerCheckWrap={verticallyCenterCheckWrap}>
          <CheckWrap isMulti={isMulti} isSelected={isSelected}>
            {isSelected && (
              <IconCheckmark
                size={isMulti ? 'xs' : 'sm'}
                color={isMulti ? 'white' : undefined}
              />
            )}
          </CheckWrap>
          {leadingItems && (
            <LeadingItems spanFullHeight={leadingItemsSpanFullHeight}>
              {leadingItems}
            </LeadingItems>
          )}
        </Indent>
        <ContentWrap
          isFocused={isFocused}
          showDividers={showDividers}
          addRightMargin={!defined(trailingItems)}
        >
          <div>
            <Label as={typeof label === 'string' ? 'p' : 'div'}>{label}</Label>
            {details && <Details>{details}</Details>}
          </div>
          {trailingItems && (
            <TrailingItems spanFullHeight={trailingItemsSpanFullHeight}>
              {trailingItems}
            </TrailingItems>
          )}
        </ContentWrap>
      </InnerWrap>
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
  ${p => p.isDisabled && `cursor: not-allowed;`}
`;

const Indent = styled('div')<{centerCheckWrap?: boolean; isMulti?: boolean}>`
  display: flex;
  justify-content: center;
  gap: ${space(1)};
  padding: ${space(1)};
  padding-left: ${space(0.5)};

  ${p => p.isMulti && !p.centerCheckWrap && `margin-top: 0.2em;`}
  ${p => p.centerCheckWrap && 'align-items: center;'}
`;

const CheckWrap = styled('div')<{isMulti: boolean; isSelected: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;

  ${p =>
    p.isMulti
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

  ${p => p.addRightMargin && `margin-right: ${space(1)};`}

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

const Label = styled('p')`
  margin-bottom: 0;
  line-height: 1.4;
  white-space: nowrap;
`;

const Details = styled('p')`
  font-size: 14px;
  line-height: 1.2;
  color: ${p => p.theme.subText};
  margin-bottom: 0;
`;

const TrailingItems = styled('div')<{spanFullHeight?: boolean}>`
  display: flex;
  align-items: center;
  height: ${p => (p.spanFullHeight ? '100%' : '1.4em')};
  gap: ${space(1)};
  margin-right: ${space(0.5)};
`;

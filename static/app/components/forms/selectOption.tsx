import {components as selectComponents} from 'react-select';
import styled from '@emotion/styled';

import {IconCheckmark} from 'sentry/icons';
import space from 'sentry/styles/space';

type Props = React.ComponentProps<typeof selectComponents.Option>;

const Option = (props: Props) => {
  return (
    <Wrap>
      <selectComponents.Option {...props}>
        <InnerWrap isFocused={props.isFocused}>
          <Indent>
            <CheckWrap isMulti={props.isMulti} isSelected={props.isSelected}>
              {props.isSelected && (
                <IconCheckmark
                  size={props.isMulti ? 'xs' : 'sm'}
                  color={props.isMulti ? 'white' : undefined}
                />
              )}
            </CheckWrap>
            {props.data.leadingItems && (
              <LeadingItems>{props.data.leadingItems}</LeadingItems>
            )}
          </Indent>
          <ContentWrap
            isFocused={props.isFocused}
            showDividers={props.selectProps.showDividers}
          >
            <Text>
              <Label>{props.label}</Label>
              {props.data.details && <Details>{props.data.details}</Details>}
            </Text>
            {props.data.leadingItems && (
              <TrailingItems>{props.data.trailingItems}</TrailingItems>
            )}
          </ContentWrap>
        </InnerWrap>
      </selectComponents.Option>
    </Wrap>
  );
};

export default Option;

const Wrap = styled('div')``;

const InnerWrap = styled('div')<{isFocused: boolean}>`
  display: flex;
  padding: 0 ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  box-sizing: border-box;

  ${p => p.isFocused && `background: ${p.theme.hover};`}
`;

const Indent = styled('div')`
  display: flex;
  justify-content: center;
  gap: ${space(1)};
  padding: ${space(1)};
  padding-left: ${space(0.5)};
`;

const CheckWrap = styled('div')<{isMulti: boolean; isSelected: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;

  ${p =>
    p.isMulti
      ? `
      margin-top: 0.2em;
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

const ContentWrap = styled('div')<{isFocused: boolean; showDividers?: boolean}>`
  position: relative;
  width: 100%;
  display: flex;
  gap: ${space(1)};
  justify-content: space-between;
  padding: ${space(1)} 0;

  ${p =>
    p.showDividers &&
    !p.isFocused &&
    `
      z-index: -1;
      box-shadow: 0 1px 0 0 ${p.theme.innerBorder};

      ${Wrap}:last-of-type & {
        box-shadow: none;
      }
    `}
`;

const LeadingItems = styled('div')`
  display: flex;
  align-items: center;
  height: 1.4em;
  gap: ${space(1)};
`;

const Text = styled('div')``;

const Label = styled('p')`
  margin-bottom: 0;
  line-height: 1.4;
`;

const Details = styled('p')`
  font-size: 14px;
  line-height: 1.2em;
  color: ${p => p.theme.subText};
  margin-bottom: 0;
`;

const TrailingItems = styled('div')`
  display: flex;
  align-items: center;
  height: 1.4em;
  gap: ${space(1)};
  margin-right: ${space(0.5)};
`;

import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {IconCheckmark, IconClose} from 'app/icons';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type BoxContent = {
  text: string;
  img?: {
    src: string;
    alt: string;
  };
};
type BoxProps = BoxContent & {
  variant: 'do' | 'dont';
  theme: Theme;
};
type DoDontProps = {
  doBox: BoxContent;
  dontBox: BoxContent;
  theme: Theme;
};

const Box = ({text, img, theme, variant}: BoxProps) => (
  <BoxWrap>
    <ImgWrap>
      <Img src={img.src} alt={img.alt} />
    </ImgWrap>
    <Captions>
      <LabelWrap>
        {variant === 'do' ? (
          <IconCheckmark theme={theme} color="green300" size="xs" />
        ) : (
          <IconClose theme={theme} color="red300" size="xs" />
        )}
        <Label className={variant === 'do' ? 'green' : 'red'}>
          {variant === 'do' ? 'DO' : "DON'T"}
        </Label>
      </LabelWrap>
      <Text>{text}</Text>
    </Captions>
  </BoxWrap>
);

const DoDont = ({doBox, dontBox, theme}: DoDontProps) => (
  <Wrapper>
    <Box {...doBox} variant="do" theme={theme} />
    <Box {...dontBox} variant="dont" theme={theme} />
  </Wrapper>
);

export default withTheme(DoDont);

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(2)};
  width: 100%;
  margin: ${space(2)} auto;
  @media only screen and (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-wrap: wrap;
    margin: ${space(4)} auto;
  }
`;
const BoxWrap = styled('div')`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
`;
const ImgWrap = styled('div')`
  position: relative;
  width: 100%;
  padding-top: 50%;
  border: solid 1px ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;
const Img = styled('img')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
const Captions = styled('div')`
  display: flex;
  align-items: flex-start;
  width: 100%;
  padding: ${space(1)};
  @media only screen and (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-wrap: wrap;
  }
`;
const LabelWrap = styled('div')`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 6em;
  margin-top: ${space(0.5)};
  @media only screen and (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-bottom: ${space(0.5)};
  }
`;
const Label = styled('p')`
  font-weight: 600;
  line-height: 1;
  margin-left: ${space(0.5)};
  margin-bottom: 0;
  &.green {
    color: ${p => p.theme.green300};
  }
  &.red {
    color: ${p => p.theme.red300};
  }
`;
const Text = styled('p')`
  margin-bottom: 0;
  color: ${p => p.theme.gray300};
`;

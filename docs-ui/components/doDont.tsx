import styled from '@emotion/styled';

import {IconCheckmark, IconClose} from 'sentry/icons';
import space from 'sentry/styles/space';

type BoxContent = {
  text: string;
  img?: {
    alt: string;
    src: string;
  };
};
type BoxProps = BoxContent & {
  variant: 'do' | 'dont';
};
type DoDontProps = {
  doBox: BoxContent;
  dontBox: BoxContent;
};

const Box = ({text, img, variant}: BoxProps) => (
  <BoxWrap>
    <ImgWrap>
      <Img src={img?.src} alt={img?.alt} />
    </ImgWrap>
    <Captions>
      <LabelWrap>
        {variant === 'do' ? (
          <IconCheckmark color="green300" size="xs" />
        ) : (
          <IconClose color="red300" size="xs" />
        )}
        <Label className={variant === 'do' ? 'green' : 'red'}>
          {variant === 'do' ? 'DO' : "DON'T"}
        </Label>
      </LabelWrap>
      <Text>{text}</Text>
    </Captions>
  </BoxWrap>
);

const DoDont = ({doBox, dontBox}: DoDontProps) => (
  <Wrapper>
    <Box {...doBox} variant="do" />
    <Box {...dontBox} variant="dont" />
  </Wrapper>
);

export default DoDont;

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
  border: solid 1px ${p => p.theme.innerBorder};
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
  color: ${p => p.theme.subText};
`;

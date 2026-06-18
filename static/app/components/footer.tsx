import styled from '@emotion/styled';

type Props = {
  className?: string;
};

// The footer is hidden now that the "page-frame" layout is fully rolled out.
// @TODO(JonasBadalic): Remove the Footer component and its usages entirely.
function BaseFooter(_props: Props) {
  return null;
}

export const Footer = styled(BaseFooter)``;

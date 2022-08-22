import styled from '@emotion/styled';
import classnames from 'classnames';

interface NavProps extends React.HTMLAttributes<HTMLUListElement> {
  underlined?: boolean;
}

function NavTabs({underlined, className, ...tabProps}: NavProps) {
  const mergedClassName = classnames('nav nav-tabs', className, {
    'border-bottom': underlined,
  });

  return <Wrap className={mergedClassName} {...tabProps} />;
}

export default NavTabs;

const Wrap = styled('ul')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

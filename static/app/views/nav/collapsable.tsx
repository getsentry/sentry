import styled from '@emotion/styled';
import {motion} from 'framer-motion';

export function Collapsable({
  children,
  collapsed,
  disabled = false,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  disabled?: boolean;
}) {
  const visualDuration = 0.3;
  if (disabled) {
    return children;
  }

  return (
    <CollapsableWrapper
      initial={collapsed ? 'collapsed' : 'open'}
      animate={collapsed ? 'collapsed' : 'open'}
      variants={{
        open: {
          height: 'auto',
          overflow: 'visible',
          transition: {
            type: 'spring',
            damping: 50,
            stiffness: 600,
            bounce: 0,
            visualDuration,
            overflow: {delay: visualDuration},
          },
        },
        collapsed: {
          height: 0,
          overflow: 'hidden',
          transition: {
            type: 'spring',
            damping: 50,
            stiffness: 600,
            bounce: 0,
            visualDuration,
          },
        },
      }}
    >
      {/* We need to wrap the children in a div to prevent the parent's flex-direction: column-reverse
      from applying to the children, which may cause the children's order to be reversed */}
      <div>{children}</div>
    </CollapsableWrapper>
  );
}

const CollapsableWrapper = styled(motion.div)`
  display: flex;
  /*
    This column-reverse is what creates the "folder" animation effect, where children "fall out" of the header
    when un-collapsed, and are "sucked in" to the header when collapsed, rather than a standard accordion effect.
  */
  flex-direction: column-reverse;
`;

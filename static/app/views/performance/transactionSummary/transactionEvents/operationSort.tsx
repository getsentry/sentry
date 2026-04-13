import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Manager, Popper, Reference} from 'react-popper';
import styled from '@emotion/styled';
import type {Location, LocationDescriptorObject} from 'history';

import {Flex} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';

import type {GetActorPropsFn} from 'sentry/components/deprecatedDropdownMenu';
import {MenuItem} from 'sentry/components/menuItem';
import {t} from 'sentry/locale';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventView} from 'sentry/utils/discover/eventView';
import {useNavigate} from 'sentry/utils/useNavigate';

export type TitleProps = Partial<ReturnType<GetActorPropsFn>>;

type Props = {
  eventView: EventView;
  location: Location;
  tableMeta: TableData['meta'];
  title: React.ComponentType<TitleProps>;
};

export function OperationSort({eventView, location, tableMeta, title: Title}: Props) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuEl = useRef<Element | null>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (event.target instanceof Element && !menuEl.current?.contains(event.target)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('click', handleClickOutside, true);
    } else {
      document.removeEventListener('click', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [handleClickOutside, isOpen]);

  const toggleOpen = useCallback(() => {
    setIsOpen(previousIsOpen => !previousIsOpen);
  }, []);

  function generateSortLink(field: any): LocationDescriptorObject | undefined {
    if (!tableMeta) {
      return undefined;
    }

    const nextEventView = eventView.sortOnField(field, tableMeta, 'desc');
    const queryStringObject = nextEventView.generateQueryStringObject();

    return {
      ...location,
      query: {...location.query, sort: queryStringObject.sort},
    };
  }

  function renderMenuItem(operation: any, title: any) {
    return (
      <DropdownMenuItem>
        <Flex justify="start" align="center" width="100%">
          <RadioLabel>
            <StyledRadio
              readOnly
              size="sm"
              checked={eventView.sorts.some(({field}) => field === operation)}
              onClick={() => {
                const sortLink = generateSortLink({field: operation});
                if (sortLink) {
                  navigate(sortLink);
                }
              }}
            />
            <span>{title}</span>
          </RadioLabel>
        </Flex>
      </DropdownMenuItem>
    );
  }

  function renderMenuContent() {
    return (
      <DropdownContent>
        {renderMenuItem('spans.http', t('Sort By HTTP'))}
        {renderMenuItem('spans.db', t('Sort By DB'))}
        {renderMenuItem('spans.resource', t('Sort By Resource'))}
        {renderMenuItem('spans.browser', t('Sort By Browser'))}
      </DropdownContent>
    );
  }

  function renderMenu() {
    const modifiers = [
      {
        name: 'hide',
        enabled: false,
      },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {padding: 10},
      },
    ];

    return createPortal(
      <Popper placement="top" modifiers={modifiers}>
        {({ref: popperRef, style, placement}) => (
          <DropdownWrapper
            ref={ref => {
              (popperRef as CallableFunction)(ref);
              menuEl.current = ref;
            }}
            style={style}
            data-placement={placement}
          >
            {renderMenuContent()}
          </DropdownWrapper>
        )}
      </Popper>,
      document.body
    );
  }

  const menu = isOpen ? renderMenu() : null;

  return (
    <Manager>
      <Reference>
        {({ref}) => (
          <TitleWrapper ref={ref}>
            <Title onClick={toggleOpen} />
          </TitleWrapper>
        )}
      </Reference>
      {menu}
    </Manager>
  );
}

const DropdownWrapper = styled('div')`
  /* Adapted from the dropdown-menu class */
  border: none;
  border-radius: 2px;
  box-shadow:
    0 0 0 1px rgba(52, 60, 69, 0.2),
    0 1px 3px rgba(70, 82, 98, 0.25);
  background-clip: padding-box;
  background-color: ${p => p.theme.tokens.background.primary};
  width: 220px;
  overflow: visible;
  z-index: ${p => p.theme.zIndex.tooltip};

  &:before,
  &:after {
    width: 0;
    height: 0;
    content: '';
    display: block;
    position: absolute;
    right: auto;
  }

  &:before {
    border-left: 9px solid transparent;
    border-right: 9px solid transparent;
    left: calc(50% - 9px);
    z-index: -2;
  }

  &:after {
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    left: calc(50% - 8px);
    z-index: -1;
  }

  &[data-placement*='bottom'] {
    margin-top: 9px;

    &:before {
      /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
      border-bottom: 9px solid ${p => p.theme.tokens.background.primary};
      top: -9px;
    }

    &:after {
      /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
      border-bottom: 8px solid ${p => p.theme.tokens.background.primary};
      top: -8px;
    }
  }

  &[data-placement*='top'] {
    margin-bottom: 9px;

    &:before {
      /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
      border-top: 9px solid ${p => p.theme.tokens.background.primary};
      bottom: -9px;
    }

    &:after {
      /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
      border-top: 8px solid ${p => p.theme.tokens.background.primary};
      bottom: -8px;
    }
  }
`;

const DropdownMenuItem = styled(MenuItem)`
  font-size: ${p => p.theme.font.size.md};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const RadioLabel = styled('label')`
  display: grid;
  cursor: pointer;
  gap: 0.25em 0.5em;
  grid-template-columns: max-content auto;
  align-items: center;
  outline: none;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  margin: 0;
`;

const StyledRadio = styled(Radio)`
  margin: 0;
`;

const DropdownContent = styled('div')`
  max-height: 250px;
  overflow-y: auto;
`;

const TitleWrapper = styled('div')`
  cursor: pointer;
`;

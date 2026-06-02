export type GetActorArgs<E extends Element> = {
  className?: string;
  onBlur?: (e: React.FocusEvent<E>) => void;
  onChange?: (e: React.ChangeEvent<E>) => void;
  onClick?: (e: React.MouseEvent<E>) => void;
  onFocus?: (e: React.FocusEvent<E>) => void;
  onKeyDown?: (e: React.KeyboardEvent<E>) => void;
  onMouseEnter?: (e: React.MouseEvent<E>) => void;
  onMouseLeave?: (e: React.MouseEvent<E>) => void;
  style?: React.CSSProperties;
};

type ActorProps<E extends Element> = {
  onClick: (e: React.MouseEvent<E>) => void;
  onKeyDown: (e: React.KeyboardEvent<E>) => void;
  onMouseEnter: (e: React.MouseEvent<E>) => void;
  onMouseLeave: (e: React.MouseEvent<E>) => void;
};

export type GetActorPropsFn = <E extends Element = Element>(
  opts?: GetActorArgs<E>
) => ActorProps<E>;

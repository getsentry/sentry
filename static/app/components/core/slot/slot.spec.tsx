import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Text} from 'sentry/components/core/text';

import {Slot} from './slot';

describe('Slot', () => {
  describe('production environment', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('renders null for invalid children', () => {
      render(<Slot>Hello</Slot>);
      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
      render(<Slot>{['Hello', 'from', 'production']}</Slot>);
      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
    });

    it('renders null if multiple children are provided', () => {
      render(
        <Slot>
          <Text>Hello</Text>
          <Text>World</Text>
        </Slot>
      );
      expect(screen.queryByText('Hello')).not.toBeInTheDocument();
      expect(screen.queryByText('World')).not.toBeInTheDocument();
    });

    it('renders the child if it is a valid element', () => {
      render(
        <Slot>
          <Text>Hello</Text>
        </Slot>
      );
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  describe('development environment', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('throws an error if children is not a valid element', () => {
      expect(() => render(<Slot>{['Hello', 'from', 'development']}</Slot>)).toThrow(
        'React.Children.only expected to receive a single React element child.'
      );
    });

    it('throws an error if children count is greater than 1', () => {
      expect(() =>
        render(
          <Slot>
            <Text>Hello</Text>
            <Text>World</Text>
          </Slot>
        )
      ).toThrow('React.Children.only expected to receive a single React element child.');
    });

    it('renders the child if it is a valid element', () => {
      render(
        <Slot>
          <Text>Hello</Text>
        </Slot>
      );
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
  });

  it('manages nested children', () => {
    render(
      <Slot>
        <div>
          <Text>Hello</Text>
        </div>
      </Slot>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('merges styles', () => {
    render(
      <Slot style={{color: 'red'}}>
        <Text style={{backgroundColor: 'blue'}}>Hello</Text>
      </Slot>
    );
    expect(screen.getByText('Hello')).toHaveStyle({
      color: 'red',
      backgroundColor: 'blue',
    });
  });

  it('merges classNames', () => {
    render(
      <Slot className="slot">
        <Text className="child">Hello</Text>
      </Slot>
    );
    expect(screen.getByText('Hello')).toHaveClass('slot', 'child');
  });

  it('merges handlers', async () => {
    const handleSlotClick = jest.fn();
    const handleChildClick = jest.fn();

    render(
      <Slot onClick={handleSlotClick}>
        <Text onClick={handleChildClick}>Hello</Text>
      </Slot>
    );

    await userEvent.click(screen.getByText('Hello'));

    expect(handleSlotClick).toHaveBeenCalledTimes(1);
    expect(handleChildClick).toHaveBeenCalledTimes(1);
  });
});

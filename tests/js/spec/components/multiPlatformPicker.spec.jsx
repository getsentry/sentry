import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MultiPlatformPicker from 'sentry/components/multiPlatformPicker';

describe('MultiPlatformPicker', function () {
  const baseProps = {
    platforms: [],
  };
  it('should only render Mobile platforms under Mobile tab', function () {
    const props = {...baseProps};
    render(<MultiPlatformPicker {...props} />);
    userEvent.click(screen.getByText('Mobile'));
    expect(screen.getByText('Android')).toBeInTheDocument();
    expect(screen.queryByText('Electron')).not.toBeInTheDocument();
  });
  it('should render renderPlatformList with Python when filtered with py', function () {
    const props = {
      ...baseProps,
    };

    render(<MultiPlatformPicker {...props} />);
    userEvent.type(screen.getByPlaceholderText('Filter Platforms'), 'py');
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.queryByText('Electron')).not.toBeInTheDocument();
  });

  it('should render renderPlatformList with Native when filtered with c++ alias', function () {
    const props = {
      ...baseProps,
    };

    render(<MultiPlatformPicker {...props} />);
    userEvent.type(screen.getByPlaceholderText('Filter Platforms'), 'c++');
    expect(screen.getByText('Native (C/C++)')).toBeInTheDocument();
    expect(screen.queryByText('Electron')).not.toBeInTheDocument();
  });

  it('should render renderPlatformList with community SDKs message if platform not found', function () {
    const props = {
      ...baseProps,
    };

    render(<MultiPlatformPicker {...props} />);
    userEvent.type(screen.getByPlaceholderText('Filter Platforms'), 'aaaaa');

    expect(screen.getByText("We don't have an SDK for that yet!")).toBeInTheDocument();
    expect(screen.queryByText('Python')).not.toBeInTheDocument();
  });

  it('should clear the platform when clear is clicked', function () {
    const props = {
      ...baseProps,
      platforms: ['java'],
      removePlatform: jest.fn(),
    };

    render(<MultiPlatformPicker {...props} />);
    userEvent.click(screen.getByTestId('icon-close'));
    expect(props.removePlatform).toHaveBeenCalledWith('java');
  });

  it('clicking on icon calls addPlatform', function () {
    const props = {
      ...baseProps,
      addPlatform: jest.fn(),
    };

    render(<MultiPlatformPicker {...props} />);
    userEvent.click(screen.getByText('Java'));
    expect(props.addPlatform).toHaveBeenCalledWith('java');
  });

  it('clicking on icon calls does not call addPlatform if already in list', function () {
    const props = {
      ...baseProps,
      platforms: ['java'],
      addPlatform: jest.fn(),
    };

    render(<MultiPlatformPicker {...props} />);
    userEvent.click(screen.getByText('Java'));
    expect(props.addPlatform).not.toHaveBeenCalled();
  });

  it('should sort serverless applications by provider then language', function () {
    const props = {...baseProps};
    render(<MultiPlatformPicker {...props} />);
    userEvent.click(screen.getByText('Serverless'));
    expect(screen.getByText('AWS Lambda')).toBeInTheDocument();
  });
});

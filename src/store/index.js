const Redux = require('redux');

const { defaultButtonHeightPx } = require('../components/common-style');
const { keyTypes } = require('../consts');
const Keys = require('../data/keys');
const KeyConfigs = require('../data/key-configs');
const Keypads = require('../data/keypads');
const CursorContexts = require('../components/input/cursor-contexts');
const GestureManager = require('../components/gesture-manager');
const VelocityTracker = require('../components/velocity-tracker');

const Settings = require('../settings');

const initialInputState = {
    keyHandler: null,
    cursor: {
        context: CursorContexts.TOP_LEVEL,
    },
};

const inputReducer = function(state = initialInputState, action) {
    switch (action.type) {
        case 'RegisterKeyHandler':
            return {
                ...state,
                keyHandler: action.keyHandler,
            };

        case 'PressKey':
            const keyConfig = KeyConfigs[action.key];
            if (keyConfig.type !== keyTypes.KEYPAD_NAVIGATION) {
                // This is probably an anti-pattern but it works for the case
                // where we don't actually control the state but we still want
                // to communicate with the other object
                return {
                    ...state,
                    cursor: state.keyHandler(keyConfig.id),
                };
            }

            // TODO(kevinb) get state from MathQuill and store it?
            return state;

        case 'SetCursor':
            return {
                ...state,
                cursor: action.cursor,
            };

        default:
            return state;
    }
};

const defaultKeypadType = Settings.keypadType;

const initialKeypadState = {
    extraKeys: Keypads[defaultKeypadType].extraKeys,
    keypadType: defaultKeypadType,
    active: true,
};

const keypadReducer = function(state = initialKeypadState, action) {
    switch (action.type) {
        case 'DismissKeypad':
            return {
                ...state,
                active: false,
            };

        case 'ConfigureKeypad':
            const { keypadType } = action.configuration;
            return {
                // TODO(charlie): For now, we're hardcoding the extra
                // symbols. However, once we've integrated with Perseus,
                // they'll be providing both the keypad type and the extra
                // symbols in one call; hence, they're packaged together as
                // a single 'configuration' object.
                extraKeys: Keypads[keypadType].extraKeys,
                keypadType,
                active: true,
            };

        case 'PressKey':
            const keyConfig = KeyConfigs[action.key];
            // NOTE(charlie): Our keypad system operates by triggering key
            // presses with key IDs in a dumb manner, such that the keys don't
            // know what they can do--instead, the store is responsible for
            // interpreting key presses and triggering the right actions when
            // they occur. Hence, we figure off a dismissal here rather than
            // dispatching a dismiss action in the first place.
            if (keyConfig.id === Keys.DISMISS) {
                return keypadReducer(state, { type: 'DismissKeypad' });
            }
            return state;

        default:
            return state;
    }
};

const initialPagerState = {
    animateToPosition: false,
    currentPage: 0,
    // The cumulative differential in the horizontal direction for the current
    // swipe.
    dx: 0,
    numPages: Keypads[defaultKeypadType].numPages,
    pageWidthPx: 0,
    velocityTracker: new VelocityTracker(),
};

const pagerReducer = function(state = initialPagerState, action) {
    switch (action.type) {
        case 'ConfigureKeypad':
            const { keypadType } = action.configuration;
            const { numPages } = Keypads[keypadType];
            return {
                ...initialPagerState,
                numPages,
            };

        case 'SetPageWidthPx':
            return {
                ...state,
                pageWidthPx: action.pageWidthPx,
            };

        case 'PressKey':
            const keyConfig = KeyConfigs[action.key];

            // Reset the keypad page if the user performs a math operation.
            if (keyConfig.type === keyTypes.MATH ||
                    keyConfig.type === keyTypes.NUMERAL) {
                return pagerReducer(state, { type: 'ResetKeypadPage' });
            } else if (keyConfig.type === keyTypes.KEYPAD_NAVIGATION) {
                if (keyConfig.id === Keys.NUMBERS) {
                    return pagerReducer(state, { type: 'ResetKeypadPage' });
                } else if (keyConfig.id === Keys.MORE) {
                    return pagerReducer(state, { type: 'PageKeypadRight' });
                }
            }
            return state;

        case 'ResetKeypadPage':
            return {
                ...state,
                animateToPosition: true,
                currentPage: 0,
                dx: 0,
            };

        case 'PageKeypadRight':
            const nextPage = Math.min(
                state.currentPage + 1,
                state.numPages - 1
            );
            return {
                ...state,
                animateToPosition: true,
                currentPage: nextPage,
                dx: 0,
            };

        case 'PageKeypadLeft':
            const prevPage = Math.max(state.currentPage - 1, 0);
            return {
                ...state,
                animateToPosition: true,
                currentPage: prevPage,
                dx: 0,
            };

        case 'SetKeypadCurrentPage':
            const boundedPage = Math.min(
                Math.max(action.page, 0),
                state.numPages - 1
            );
            return {
                ...state,
                currentPage: boundedPage,
                dx: 0,
            };

        case 'OnSwipeChange':
            state.velocityTracker.push(action.dx);

            return {
                ...state,
                animateToPosition: false,
                dx: action.dx,
            };

        case 'OnSwipeEnd':
            const { pageWidthPx, velocityTracker } = state;
            const { dx } = action;
            const velocity = velocityTracker.getVelocity();

            // NOTE(charlie): These will need refinement. The velocity comes
            // from Framer.
            const minFlingVelocity = 0.1;
            const minFlingDistance = 10;

            const shouldPageRight = (dx < -pageWidthPx / 2) ||
                (velocity < -minFlingVelocity && dx < -minFlingDistance);

            const shouldPageLeft = (dx > pageWidthPx / 2) ||
                (velocity > minFlingVelocity && dx > minFlingDistance);

            if (shouldPageRight) {
                return pagerReducer(state, { type: 'PageKeypadRight' });
            } else if (shouldPageLeft) {
                return pagerReducer(state, { type: 'PageKeypadLeft' });
            }

            return {
                ...state,
                animateToPosition: true,
                dx: 0,
            };

        default:
            return state;
    }
};

const createGestureManager = (swipeEnabled) => {
    return new GestureManager({
        swipeEnabled,
    }, {
        onSwipeChange: (dx) => {
            store.dispatch({
                type: 'OnSwipeChange',
                dx,
            });
        },
        onSwipeEnd: (dx) => {
            store.dispatch({
                type: 'OnSwipeEnd',
                dx,
            });
        },
        onActiveNodesChanged: (activeNodes) => {
            store.dispatch({
                type: 'SetActiveNodes',
                activeNodes,
            });
        },
        onClick: (key, layoutProps) => {
            store.dispatch({
                type: 'PressKey',
                key,
                ...layoutProps,
            });
        },
    });
};

const initialGestureState = {
    popover: null,
    focus: null,
    gestureManager: createGestureManager(
        Keypads[defaultKeypadType].numPages > 1
    ),
};

const gestureReducer = function(state = initialGestureState, action) {
    switch (action.type) {
        case 'SetActiveNodes':
            return {
                ...state,
                ...action.activeNodes,
            };

        case 'ConfigureKeypad':
            const { keypadType } = action.configuration;
            const { numPages } = Keypads[keypadType];
            const swipeEnabled = numPages > 1;
            return {
                popover: null,
                focus: null,
                gestureManager: createGestureManager(swipeEnabled),
            };

        default:
            return state;
    }
};

// Used to generate unique animation IDs for the echo animations. The actual
// values are irrelevant as long as they are unique.
let _lastAnimationId = 0;

const initialEchoState = {
    echoes: [],
};

const echoReducer = function(state = initialEchoState, action) {
    switch (action.type) {
        case 'PressKey':
            const keyConfig = KeyConfigs[action.key];

            // Reset the keypad if the user performs a math operation.
            if (keyConfig.type === keyTypes.MATH ||
                    keyConfig.type === keyTypes.NUMERAL) {
                // Add in the echo animation.
                return {
                    ...state,
                    echoes: [
                        ...state.echoes,
                        {
                            animationId: "" + _lastAnimationId++,
                            borders: action.borders,
                            id: keyConfig.id,
                            initialBounds: action.initialBounds,
                        },
                    ],
                };
            }
            return state;

        case 'RemoveEcho':
            const remainingEchoes = state.echoes.filter((echo) => {
                return echo.animationId !== action.animationId;
            });
            return {
                ...state,
                echoes: remainingEchoes,
            };

        default:
            return state;
    }
};

const initialButtonsState = {
    buttonHeightPx: defaultButtonHeightPx,
};

const buttonsReducer = function(state = initialButtonsState, action) {
    switch (action.type) {
        case 'SetButtonHeightPx':
            return {
                ...state,
                buttonHeightPx: action.buttonHeightPx,
            };

        default:
            return state;
    }
};

const reducer = Redux.combineReducers({
    input: inputReducer,
    keypad: keypadReducer,
    pager: pagerReducer,
    gestures: gestureReducer,
    echoes: echoReducer,
    buttons: buttonsReducer,
});

const store = Redux.createStore(reducer);

module.exports = store;

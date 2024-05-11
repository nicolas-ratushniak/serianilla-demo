import {readReferenceChain, readReferenceValue, readStringValue, skipSpaces} from "./shared.js";

export const readEventName = (input, current) => {
    const STOP_CHARS = '= ';
    const IMPLICIT = /^[a-z]+$/;            // lowercase
    const BUBBLING = /^[A-Z][a-zA-Z]+$/;    // UpperCamelCase

    let value = input[current];
    let char = input[++current];

    while (!STOP_CHARS.includes(char)) {
        value += char;
        char = input[++current];
    }

    let isBubbling;

    if (IMPLICIT.test(value)) {
        isBubbling = false;
    } else if (BUBBLING.test(value)) {
        isBubbling = true;
    } else {
        throw new TypeError(`Invalid event name "on${value}"`)
    }
    return [value.toLowerCase(), isBubbling, current];
}

export const processEventToken = (input, current) => {
    let eventName, isBubbling;
    [eventName, isBubbling, current] = readEventName(input, current);

    let char = input[current];

    if (char !== '=') {
        throw new TypeError(`Invalid bubbling event "on${eventName}": Empty events are not allowed`)
    }

    current = skipSpaces(input, ++current);
    char = input[current];

    if (char !== '{') {
        throw new TypeError(`Unresolved bubbling event value at ${current}. '{' expected, got '${char}'`);
    }

    const tmpCurrent = current;

    current = skipSpaces(input, ++current);
    char = input[current];

    if (char === '$') {
        let refChainInfo;
        [refChainInfo, current] = readReferenceChain(input, current);

        const token = {
            type: 'event',
            name: eventName,
            isBubbling,
            valueType: 'ref-chain',
            value: refChainInfo
        };
        return [token, current];
    }

    current = tmpCurrent;
    let ref;
    [ref, current] = readReferenceValue(input, current);

    const token = {
        type: 'event',
        name: eventName,
        isBubbling,
        valueType: 'ref',
        value: ref
    };
    return [token, current];
}

export const readRegularTagName = (input, current) => {
    const VALID_CHAR = /[^/>\s]/;
    const VALID_WORD = /^([a-z][a-z0-9]*)(-[a-z0-9]+)*$/;   // kebab-case

    let value = input[current];

    while (VALID_CHAR.test(input[++current])) {
        value += input[current];
    }

    if (!VALID_WORD.test(value)) {
        throw new TypeError(`Invalid regular tag name "${value}"`)
    }

    return [value, current]
}

export const readAttributeName = (input, current) => {
    const VALID_CHAR = /[^=/>\s]/;
    const VALID_WORD = /^(([a-z][a-z0-9]*)(-[a-z0-9]+)*|[a-z][a-zA-Z0-9]+)$/;   // kebab-case or lowerCamelCase

    let value = input[current];

    while (VALID_CHAR.test(input[++current])) {
        value += input[current];
    }

    if (!VALID_WORD.test(value)) {
        throw new TypeError(`Invalid attribute name "${value}"`)
    }

    return [value, current];
}

export const processAttributeToken = (input, current) => {
    let attrName;
    [attrName, current] = readAttributeName(input, current);

    let char = input[current];

    if (char !== '=') {
        current = skipSpaces(input, current);

        const token = {
            type: 'attr',
            name: attrName,
            valueType: 'empty'
        };
        return [token, current];
    }

    current = skipSpaces(input, ++current);
    char = input[current];

    if (char !== '"' && char !== '{') {
        throw new TypeError(`Unresolved attribute value at ${current}. '{' or '"' expected, got '${char}'`);
    }

    if (char === '"') {
        let string;
        [string, current] = readStringValue(input, current)

        const token = {
            type: 'attr',
            name: attrName,
            valueType: 'string',
            value: string
        };
        return [token, current];
    }

    const tmpCurrent = current;

    current = skipSpaces(input, ++current);
    char = input[current];

    if (char === '$') {
        let refChainInfo;
        [refChainInfo, current] = readReferenceChain(input, current);

        const token = {
            type: 'attr',
            name: attrName,
            valueType: 'ref-chain',
            value: refChainInfo
        };
        return [token, current];
    }
    current = tmpCurrent;

    let ref;
    [ref, current] = readReferenceValue(input, current);

    const token = {
        type: 'attr',
        name: attrName,
        valueType: 'ref',
        value: ref
    };
    return [token, current];
}

export const processRegularTagBodyStart = (input, current) => {
    let tagName;
    [tagName, current] = readRegularTagName(input, current);

    const token = {
        type: 'tag-body-start',
        name: tagName,
        isCommand: false,
        isCustom: false
    };

    current = skipSpaces(input, current);
    return [token, current];
}

export const processRegularTagBody = (input, current) => {
    const STOP_CHARS = '/>';
    const tokens = [];

    let char = input[current];

    while (!STOP_CHARS.includes(char)) {
        let token;

        if (char + input[current + 1] === 'on') {
            current += 2;

            [token, current] = processEventToken(input, current);
            tokens.push(token);
        } else {
            [token, current] = processAttributeToken(input, current);
            tokens.push(token);
        }
        char = input[current];
    }

    return [tokens, current];
}

export const processRegularTagChildrenEnd = (input, current) => {
    let tagName;
    [tagName, current] = readRegularTagName(input, current);

    // skip the upcoming ">"
    current = skipSpaces(input, ++current);

    const token = {
        type: 'tag-child-end',
        name: tagName
    };

    return [token, current];
}
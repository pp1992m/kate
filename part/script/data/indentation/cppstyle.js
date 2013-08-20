/* kate-script
 * name: C++/boost Style
 * license: LGPL
 * author: Alex Turbov <i.zaufi@gmail.com>
 * revision: 10
 * kate-version: 3.4
 * priority: 10
 * indent-languages: C++11, C++11/Qt4
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License version 2 as published by the Free Software Foundation.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this library; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA 02110-1301, USA.
 */

/**
 * \warning This indenter designed to be used with my C++ style! It consists
 * of mix of boost and STL styles + some my, unfortunately (still)
 * undocumented additions I've found useful after ~15 years of C++ coding.
 * So \b LOT of things here are \b HARDCODED and I \b DON'T care about other
 * styles!!!
 *
 * Ok, you've been warned :-)
 *
 * Some settings it assumes being in effect:
 * indent-width 4;
 * space-indent true;
 * auto-brackets true;
 * replace-tabs true;
 * replace-tabs-save true;
 *
 * \todo Better to check (assert) some of that modelines...
 */

// required katepart js libraries
require ("range.js");
require ("string.js");

// specifies the characters which should trigger indent, beside the default '\n'
// ':' is for `case'/`default' and class access specifiers: public, protected, private
// '/' is for single line comments
// ',' for parameter list
// '<' and '>' is for templates
// '#' is for preprocessor directives
// ')' is for align dangling close bracket
// ';' is for align `for' parts
// ' ' is to add a '()' after `if', `while', `for', ...
// TBD <others>
triggerCharacters = "{}()<>/:;,#\\?|/%.@ ";

var debugMode = false;

/// \todo Move to a separate library?
function dbg()
{
    if (debugMode)
    {
        debug.apply(this, arguments);
    }
}

//BEGIN global variables and functions
var gIndentWidth = 4;
var gSameLineCommentStartAt = 60;                           ///< Position for same-line-comments (inline comments)
var gMode = "C++11";
var gAttr = "Normal Text";
var gBraceMap = {
    '(': ')', ')': '('
  , '<': '>', '>': '<'
  , '{': '}', '}': '{'
  , '[': ']', ']': '['
  };
//END global variables and functions

/// Check if given line/column located withing a braces
function isInsideBraces(line, column, ch)
{
    var cursor = document.anchor(line, column, ch);
    return cursor.isValid();
}

/**
 * Split a given text line by comment into parts \e before and \e after the comment
 * \return an object w/ the following fields:
 *   \li \c hasComment -- boolean: \c true if comment present on the line, \c false otherwise
 *   \li \c before -- text before the comment
 *   \li \c after -- text of the comment
 *
 * \todo Make it smart and check highlighting style where \c '//' string is found.
 * \todo Possible it would be quite reasonable to analyze a type of the comment:
 * Is it C++ or Doxygen? Is it single or w/ some text before?
 */
function splitByComment(text)
{
    var commentStartPos = text.indexOf("//");
    var before = "";
    var after = "";
    var found = commentStartPos != -1;
    if (found)
    {
        before = text.substring(0, commentStartPos);
        after = text.substring(commentStartPos + 2, text.length);
    }
    else before = text;
    return {hasComment: found, before: before, after: after};
}

/**
 * \brief Remove possible comment from text
 */
function stripComment(text)
{
    var result = splitByComment(text);
    if (result.hasComment)
        return result.before.rtrim();
    return text.rtrim();
}

/// Return \c true if attribute at given position is a \e String or \e Comment
function isStringOrComment(line, column)
{
    // Check if we are not withning a string or a comment
    var c = new Cursor(line, column);
    var mode = document.attributeName(c);
    dbg("isStringOrComment: Check mode @ " + c + ": " + mode);
    return gMode == "Doxygen" || document.isString(c) || document.isComment(c);
}

/// Try to (re)align (to 60th position) inline comment if present
function alignInlineComment(line)
{
    // Check is there any comment on the current line
    var currentLineText = document.line(line);
    var sc = splitByComment(currentLineText);
    // Did we found smth and if so, make sure it is not a string or comment...
    if (sc.hasComment && !isStringOrComment(line, sc.before.length - 1))
    {
        var rbefore = sc.before.rtrim();
        /// \attention Kate has a BUG: even if everything is Ok and no realign
        /// required, document gets modified anyway! So condition below
        /// designed to prevent document modification w/o real actions won't
        /// help anyway :-( Need to fix Kate before!
        if (rbefore.length < gSameLineCommentStartAt && sc.before.length != gSameLineCommentStartAt)
        {
            // Ok, test on the line is shorter than needed.
            // But what about current padding?
            document.editBegin();
            if (sc.before.length < gSameLineCommentStartAt)
                // Need to add some padding
                document.insertText(
                    line
                  , sc.before.length
                  , String().fill(' ', gSameLineCommentStartAt - sc.before.length)
                  );
            else
                // Need to remove a redundant padding
                document.removeText(line, gSameLineCommentStartAt, line, sc.before.length);
            document.editEnd();
        }
        else if (gSameLineCommentStartAt < rbefore.length)
        {
            // Move inline comment before the current line
            var startPos = document.firstColumn(line);
            currentLineText = String().fill(' ', startPos) + "//" + sc.after.rtrim() + "\n";
            document.editBegin();
            document.removeText(line, rbefore.length, line, document.lineLength(line));
            document.insertText(line, 0, currentLineText);
            document.editEnd();
        }
    }
}

/**
 * Try to keep same-line comment.
 * I.e. if \c ENTER was hit on a line w/ inline comment and before it,
 * try to keep it on a previous line...
 */
function tryToKeepInlineComment(line)
{
    // Make sure that there is some text still present on a prev line
    // i.e. it was just splitted and same-line-comment must be moved back to it
    if (document.line(line - 1).trim().length == 0)
        return;

    // Check is there any comment on the current line
    var currentLineText = document.line(line);
    var sc = splitByComment(currentLineText);
    if (sc.hasComment && !isStringOrComment(line, sc.before.length - 1) && sc.after.length > 0)
    {
        // Ok, here is few cases possible when ENTER pressed in different positions
        // |  |smth|was here; |        |// comment
        //
        // If sc.before has some text, it means that cursor was in the middle of some
        // non-commented text, and part of it left on a prev line, so we have to move
        // the comment back to that line...
        if (sc.before.trim().length > 0)                    // Is there some text before comment?
        {
            var lastPos = document.lastColumn(line - 1);    // Get last position of non space char @ prev line
            // Put the comment text to the prev line w/ padding
            document.insertText(
                line - 1
              , lastPos + 1
              , String().fill(' ', gSameLineCommentStartAt - lastPos - 1)
                  + "//"
                  + sc.after.rtrim()
              );
            // Remove it from current line starting from current position
            // 'till the line end
            document.removeText(line, sc.before.rtrim().length, line, currentLineText.length);
        }
        else
        {
            // No text before comment. Need to remove possible spaces from prev line...
            var prevLine = line - 1;
            document.removeText(
                prevLine
              , document.lastColumn(prevLine) + 1
              , prevLine
              , document.lineLength(prevLine)
              );
        }
    }
}

/**
 * Return a current preprocessor indentation level
 * \note <em>preprocessor indentation</em> means how deep the current line
 * inside of \c #if directives.
 * \warning Negative result means that smth wrong w/ a source code
 */
function getPreprocessorLevelAt(line)
{
    // Just follow towards start and count #if/#endif directives
    var currentLine = line;
    var result = 0;
    while (currentLine >= 0)
    {
        currentLine--;
        var currentLineText = document.line(currentLine);
        if (currentLineText.search(/^\s*#\s*(if|ifdef|ifndef)\s+.*$/) != -1)
            result++;
        else if (currentLineText.search(/^\s*#\s*endif.*$/) != -1)
            result--;
    }
    return result;
}

/**
 * Check if \c ENTER was hit between ()/{}/[]/<>
 * \todo Match closing brace forward, put content between
 * braces on a separate line and align a closing brace.
 */
function tryBraceSplit_ch(line)
{
    var result = -1;
    // Get last char from previous line (opener) and a first from the current (closer)
    var firstCharPos = document.lastColumn(line - 1);
    var firstChar = document.charAt(line - 1, firstCharPos);
    var lastCharPos = document.firstColumn(line);
    var lastChar = document.charAt(line, lastCharPos);

    var isCurveBracketsMatched = (firstChar == '{' && lastChar == '}');
    var isBracketsMatched = isCurveBracketsMatched
        || (firstChar == '[' && lastChar == ']')
        || (firstChar == '(' && lastChar == ')')
        || (firstChar == '<' && lastChar == '>')
        ;
    if (isBracketsMatched)
    {
        var currentIndentation = document.firstVirtualColumn(line - 1);
        result = currentIndentation + gIndentWidth;
        document.editBegin();
        document.insertText(line, document.firstColumn(line), "\n");
        document.indent(new Range(line + 1, 0, line + 1, 1), currentIndentation / gIndentWidth);
        // Add half-tab (2 spaces) if matched not a curve bracket or
        // open character isn't the only one on the line
        var isOpenCharTheOnlyOnLine = (document.firstColumn(line - 1) == firstCharPos);
        if (!(isCurveBracketsMatched || isOpenCharTheOnlyOnLine))
            document.insertText(line + 1, document.firstColumn(line + 1), "  ");
        document.editEnd();
        view.setCursorPosition(line, result);
    }
    if (result != -1)
    {
        dbg("tryBraceSplit_ch result="+result);
        tryToKeepInlineComment(line);
    }
    return result;
}

/**
 * Even if counterpart brace not found (\sa \c tryBraceSplit_ch), align the current line
 * to one level deeper if last char on a previous line is one of open braces.
 * \code
 *     foo(|blah);
 *     // or
 *     {|
 *     // or
 *     smth<|blah, blah>
 *     // or
 *     array[|idx] = blah;
 * \endcode
 */
function tryToAlignAfterOpenBrace_ch(line)
{
    var result = -1;
    var pos = document.lastColumn(line - 1);
    var ch = document.charAt(line - 1, pos);

    if (ch == '(' || ch == '[')
    {
        result = document.firstColumn(line - 1) + gIndentWidth;
    }
    else if (ch == '{')
    {
        if (document.startsWith(line - 1, "namespace", true))
            result = 0;
        else
            result = document.firstColumn(line - 1) + gIndentWidth;
    }
    else if (ch == '<')
    {
        // Does it looks like 'operator<<'?
        if (document.charAt(line - 1, pos - 1) != '<')
            result = document.firstColumn(line - 1) + gIndentWidth;
        else
            result = document.firstColumn(line - 1) + 2;
    }

    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryToAlignOpenBrace_ch result="+result);
    }
    return result;
}

function tryToAlignBeforeCloseBrace_ch(line)
{
    var result = -1;
    var pos = document.firstColumn(line);
    var ch = document.charAt(line, pos);

    if (ch == '}' || ch == ')' || ch == ']')
    {
        var openBracePos = document.anchor(line, pos, ch);
        dbg("Found open brace @ "+openBracePos)
        if (openBracePos.isValid())
            result = document.firstColumn(openBracePos.line) + (ch == '}' ? 0 : 2);
    }
    else if (ch == '>')
    {
        // TBD
    }

    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryToAlignBeforeCloseBrace_ch result="+result);
    }
    return result;
}

function tryToAlignBeforeComma_ch(line)
{
    var result = -1;
    var pos = document.firstColumn(line);
    var ch = document.charAt(line, pos);

    if (line > 0 && (ch == ',' || ch == ';'))
    {
        var openBracePos = document.anchor(line, pos, '(');
        if (!openBracePos.isValid())
            openBracePos = document.anchor(line, pos, '[');

        if (openBracePos.isValid())
            result = document.firstColumn(openBracePos.line) + 2;
    }

    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryToAlignBeforeComma_ch result="+result);
    }
    return result;
}

/// Check if a multiline comment introduced on a previous line
function tryMultilineCommentStart_ch(line)
{
    var result = -1;
    // Check if multiline comment was started on the line
    // and ENTER wan't pressed right after a /*C-style comment*/
    if (document.startsWith(line - 1, "/*", true) && !document.endsWith(line - 1, "*/", true))
    {
        var filler = String().fill(' ', document.firstVirtualColumn(line - 1) + 1);
        var padding = filler + "* ";
        // If next line (if present) doesn't looks like a continue of the current comment,
        // then append a comment closer also...
        if ((line + 1) < document.lines())
        {
            // Maybe user wants to extend a multiline C-style/Doxygen comment
            // by pressing ENTER at start of it?
            if (!document.startsWith(line + 1, "*", true))
            {
                // ... doesn't looks like a multiline comment
                padding += "\n" + filler;
                // Maybe user just splits a C-style comment?
                if (!document.startsWith(line, "*/", true))
                    padding += document.endsWith(line, "*/", true) ? "* " : "*/";
                else
                    document.removeText(line, 0, line, document.firstColumn(line))
            }                                               // else, no need to append a closing */
        }
        else                                                // There is no a next line...
        {
            padding += "\n" + filler;
            if (!document.startsWith(line, "*/", true))
                padding += document.endsWith(line, "*/", true) ? "* " : "*/";
            else
                document.removeText(line, 0, line, document.firstColumn(line))
        }

        document.insertText(line, 0, padding);
        view.setCursorPosition(line, filler.length + 2);
        result = -2;
    }
    if (result != -1)
    {
        dbg("tryMultilineCommentStart_ch result="+result);
    }
    return result;
}

/// Check if \c ENTER was hit inside or at last line of a multiline comment
function tryMultilineCommentCont_ch(line)
{
    var result = -1;
    // Check if multiline comment continued on the line:
    // 0) it starts w/ a start
    // 1) and followed by a space (i.e. it doesn't looks like a dereference) or nothing
    var firstCharPos = document.firstColumn(line - 1);
    var prevLineFirstChar = document.charAt(line - 1, firstCharPos);
    var prevLineSecondChar = document.charAt(line - 1, firstCharPos + 1);
    if (prevLineFirstChar == '*' && (prevLineSecondChar == ' ' || prevLineSecondChar == -1))
    {
        if (document.charAt(line - 1, firstCharPos + 1) == '/')
            // ENTER pressed after multiline comment: unindent 1 space!
            result = firstCharPos - 1;
        else
        {
            // Ok, ENTER pressed inside of the multiline comment:
            // just append one more line...
            var filler = String().fill(' ', document.firstColumn(line - 1));
            // Try to continue a C-style comment
            document.insertText(line, 0, filler + "* ");
            result = filler.length;
        }
    }
    if (result != -1)
    {
        dbg("tryMultilineCommentCont_ch result="+result);
    }
    return result;
}

function tryAfterCloseMultilineComment_ch(line)
{
    var result = -1;
    if (document.startsWith(line - 1, "*/", true))
    {
        result = document.firstColumn(line - 1) - 1;
    }
    if (result != -1)
    {
        dbg("tryAfterCloseMultilineComment_ch result="+result);
    }
    return result;
}

/**
 * Check if a current line has a text after cursor position
 * and a previous one has a comment, then append a <em>"// "</em>
 * before cursor and realign if latter was inline comment...
 */
function trySplitComment_ch(line)
{
    var result = -1;
    if (document.lastColumn(line) != -1)
    {
        // Ok, current line has some text after...
        // NOTE There is should be at least one space between
        // the text and the comment
        var match = /^(.*\s)(\/\/)(.*)$/.exec(document.line(line - 1));
        if (match != null && 0 < match[3].trim().length)    // If matched and there is some text in a comment
        {
            if (0 < match[1].trim().length)                 // Is there some text before the comment?
            {
                // Align comment to gSameLineCommentStartAt
                result = gSameLineCommentStartAt;
            }
            else
            {
                result = match[1].length;
            }
            var leadMatch = /^([^\s]*\s+).*$/.exec(match[3]);
            var lead = "";
            if (leadMatch != null)
                lead = leadMatch[1];
            else
                lead = " ";
            document.insertText(line, 0, "//" + lead);
        }
    }
    if (result != -1)
    {
        dbg("trySplitComment_ch result="+result);
    }
    return result;
}

/// Indent a next line after some keywords
function tryIndentAfterSomeKeywords_ch(line)
{
    var result = -1;
    // Check if ENTER was pressed after some keywords...
    var prevString = document.line(line - 1);
    var r = /^(\s*)((if|for|while)\s*\(|\bdo\b|(public|protected|private|default|case\s+.*)\s*:).*$/
      .exec(prevString);
    if (r != null)
    {
        dbg("r=",r);
        result = r[1].length + gIndentWidth;
    }
    else
    {
        r = /^\s*\belse\b.*$/.exec(prevString)
        if (r != null)
        {
            var prevPrevString = document.line(line - 2);
            prevPrevString = stripComment(prevPrevString);
            dbg("tryIndentAfterSomeKeywords_ch prevPrevString="+prevPrevString);
            if (prevPrevString.endsWith('}'))
                result = document.firstColumn(line - 2);
            else if (prevPrevString.match(/^\s*[\])>]/))
                result = document.firstColumn(line - 2) - gIndentWidth - (gIndentWidth/2);
            else
                result = document.firstColumn(line - 2) - gIndentWidth;
            // Realign 'else' statement if needed
            var pp = document.firstColumn(line - 1);
            if (pp < result)
                document.insertText(line - 1, 0, String().fill(' ', result - pp));
            else if (result < pp)
                document.removeText(line - 1, 0, line - 1, pp - result);
            result += gIndentWidth;
        }
    }
    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryIndentAfterSomeKeywords_ch result="+result);
    }
    return result;
}

/**
 * Try to indent a line right after a dangling semicolon
 * (possible w/ leading close braces and comment after)
 * \code
 *     foo(
 *         blah
 *     );|
 * \endcode
 */
function tryAfterDanglingSemicolon_ch(line)
{
    var result = -1;
    var prevString = document.line(line - 1);
    var r = /^(\s*)(([\)\]}]?\s*)*([\)\]]\s*))?;/.exec(prevString);
    if (r != null)
    {
        result = Math.floor(r[1].length / 4) * 4;           /// TODO JS highlighter BUG
    }
    else
    {
        // Does it looks like a template tail?
        // i.e. smth like this:
        // typedef boost::mpl::blah<
        //    params
        //  > type;|
        r = /^(\s*)([>]+).*;/.exec(prevString);
        if (r != null)
            result = Math.floor(r[1].length / 4) * 4;       /// TODO JS highlighter BUG
    }
    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryDanglingSemicolon_ch result="+result);
    }
    return result;
}

/**
 * Check if \c ENTER pressed after equal sign
 * \code
 *     blah =
 *         |blah
 * \endcode
 */
function tryAfterEqualChar_ch(line)
{
    var result = -1;
    var pos = document.lastColumn(line - 1);
    if (document.charAt(line - 1, pos) == '=')
        result = document.firstColumn(line - 1) + gIndentWidth;
    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryAfterEqualChar_ch result="+result);
    }
    return result;
}

/// Check if \c ENTER hits after \c #define w/ a backslash
function tryMacroDefinition_ch(line)
{
    var result = -1;
    var prevString = document.line(line - 1);
    if (prevString.search(/^\s*#\s*define\s+.*\\$/) != -1)
        result = gIndentWidth;
    if (result != -1)
    {
        dbg("tryMacroDefinition_ch result="+result);
    }
    return result;
}

/**
 * Do not incrase indent if ENTER pressed before access
 * specifier (i.e. public/private/protected)
 */
function tryBeforeAccessSpecifier_ch(line)
{
    var result = -1;
    if (document.line(line).match(/(public|protected|private):/))
    {
        var openPos = document.anchor(line, 0, '{');
        if (openPos.isValid())
            result = document.firstColumn(openPos.line);
    }
    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryBeforeAccessSpecifier_ch result="+result);
    }
    return result;
}

/**
 * Try to align a line w/ a leading (word) delimiter symbol
 * (i.e. not an identifier and a brace)
 */
function tryBeforeDanglingDelimiter_ch(line)
{
    var result = -1;
    var halfTabNeeded =
        // current line do not starts w/ a comment
        !document.line(line).ltrim().startsWith("//")
        // if a previous line starts w/ an identifier
      && (document.line(line - 1).search(/^\s*[A-Za-z_][A-Za-z0-9_]*/) != -1)
        // but the current one starts w/ a delimiter (which is looks like operator)
      && (document.line(line).search(/^\s*[,%&<=:\|\-\?\/\+\*\.]/) != -1)
      ;
    // check if we r at function call or array index
    var insideBraces = document.anchor(line, document.firstColumn(line), '(').isValid()
      || document.anchor(line, document.firstColumn(line), '[').isValid()
      ;
    if (halfTabNeeded)
        result = document.firstVirtualColumn(line - 1) + (insideBraces ? -2 : 2);
    if (result != -1)
    {
        tryToKeepInlineComment(line);
        dbg("tryBeforeDanglingDelimiter_ch result="+result);
    }
    return result;
}

function tryPreprocessor_ch(line)
{
    var result = -1;
    if (document.firstChar(line) == '#')
    {
        result = 0;
        var text = document.line(line);
        // Get current depth level
        var currentLevel = getPreprocessorLevelAt(line);
        if (currentLevel > 0)
        {
            // How much spaces we have after hash?
            var spacesCnt = 0;
            var column = document.firstColumn(line) + 1;
            var i = column;
            for (; i < text.length; i++)
            {
                if (text[i] != ' ')
                    break;
                spacesCnt++;
            }
            var wordAfterHash = document.wordAt(line, i);
            dbg("wordAfterHash='"+wordAfterHash+"'");
            if (wordAfterHash[0] == '#')
                wordAfterHash = wordAfterHash.substring(1, wordAfterHash.length);
            if (wordAfterHash == "else" || wordAfterHash == "elif" || wordAfterHash == "endif")
                currentLevel--;
            var paddingLen = (currentLevel == 0) ? 0 : (currentLevel - 1) * 2 + 1;
            if (spacesCnt < paddingLen)
            {
                var padding = String().fill(' ', paddingLen - spacesCnt);
                document.insertText(line, column, padding);
            }
            else if (paddingLen < spacesCnt)
            {
                document.removeText(line, column, line, column + spacesCnt - paddingLen);
            }
        }
    }
    if (result != -1)
    {
        dbg("tryPreprocessor_ch result="+result);
    }
    return result;
}

/**
 * Check if \c ENTER was pressed on a start of line and
 * after a block comment.
 */
function tryAfterBlockComment_ch(line)
{
    var result = -1;
    if (0 < line)
    {
        var prev_non_empty_line = document.prevNonEmptyLine(line - 1);
        if (prev_non_empty_line != -1 && document.line(prev_non_empty_line).trim().startsWith("*/"))
        {
            var p = document.firstColumn(prev_non_empty_line);
            if ((p % gIndentWidth) != 0)
                result = Math.floor(p / gIndentWidth) * gIndentWidth;
        }
    }
    if (result != -1)
    {
        dbg("tryAfterBlockComment_ch result="+result);
    }
    return result;
}

/// Wrap \c tryToKeepInlineComment as \e caret-handler
function tryToKeepInlineComment_ch(line)
{
    tryToKeepInlineComment(line);
    return -1;
}

/**
 * \brief Handle \c ENTER key
 */
function caretPressed(cursor)
{
    var result = -1;
    var line = cursor.line;

    // Dunno what to do if previous line isn't available
    if (line - 1 < 0)
        return result;                                      // Nothing (dunno) to do if no previous line...

    // Register all indent functions
    var handlers = [
        tryBraceSplit_ch                                    // Handle ENTER between braces
      , tryMultilineCommentStart_ch
      , tryMultilineCommentCont_ch
      , tryAfterCloseMultilineComment_ch
      , trySplitComment_ch
      , tryToAlignAfterOpenBrace_ch                         // Handle {,[,(,< on a previous line
      , tryToAlignBeforeCloseBrace_ch                       // Handle },],),> on a current line before cursor
      , tryToAlignBeforeComma_ch                            // Handle ENTER pressed before comma or semicolon
      , tryIndentAfterSomeKeywords_ch                       // NOTE It must follow after trySplitComment_ch!
      , tryAfterDanglingSemicolon_ch
      , tryMacroDefinition_ch
      , tryBeforeDanglingDelimiter_ch
      , tryBeforeAccessSpecifier_ch
      , tryAfterEqualChar_ch
      , tryPreprocessor_ch
      , tryAfterBlockComment_ch
      , tryToKeepInlineComment_ch                           // NOTE This must be a last checker!
    ];

    // Apply all all functions until result gets changed
    for (
        var i = 0
      ; i < handlers.length && result == -1
      ; result = handlers[i++](line)
      );

    return result;
}

/**
 * \brief Handle \c '/' key pressed
 *
 * Check if is it start of a comment. Here is few cases possible:
 * \li very first \c '/' -- do nothing
 * \li just entered \c '/' is a second in a sequence. If no text before or some present after,
 *     do nothing, otherwise align a \e same-line-comment to \c gSameLineCommentStartAt
 *     position.
 * \li just entered \c '/' is a 3rd in a sequence. If there is some text before and no after,
 *     it looks like inlined doxygen comment, so append \c '<' char after. Do nothing otherwise.
 * \li if there is a <tt>'// '</tt> string right before just entered \c '/', form a
 *     doxygen comment <tt>'///'</tt> or <tt>'///<'</tt> depending on presence of some text
 *     on a line before the comment.
 *
 * \todo Due the BUG #316809 in a current version of Kate, this code doesn't work as expected!
 * It always returns a <em>"NormalText"</em>!
 * \code
 * var cm = document.attributeName(cursor);
 * if (cm.indexOf("String") != -1)
 *    return;
 * \endcode
 *
 * \bug This code doesn't work properly in the following case:
 * \code
 *  std::string bug = "some text//
 * \endcode
 *
 * \todo Refactoring required to avoid regex here... better to use \c splitByComment()
 */
function trySameLineComment(cursor)
{
    var line = cursor.line;
    var column = cursor.column;

    // First of all check that we are not withing a string
    if (document.isString(line, column)) {
        return;
    }

    var sc = splitByComment(document.line(line));
    if (sc.hasComment)                                      // Is there any comment on a line?
    {
        // Make sure we r not in a comment already
        if (document.isComment(line, document.firstColumn(line)) &&
          (document.line(line) != '///')) {
            return;
        }
        // If no text after the comment and it still not aligned
        var text_len = sc.before.rtrim().length;
        if (text_len != 0 && sc.after.length == 0 && text_len < gSameLineCommentStartAt)
        {
            // Align it!
            document.insertText(
                line
              , column - 2
              , String().fill(' ', gSameLineCommentStartAt - text_len)
              );
            document.insertText(line, gSameLineCommentStartAt + 2, ' ');
        }
        // If text in a comment equals to '/' or ' /' -- it looks like a 3rd '/' pressed
        else if (sc.after == " /" || sc.after == "/")
        {
            // Form a Doxygen comment!
            document.removeText(line, column - sc.after.length, line, column);
            document.insertText(line, column - sc.after.length, text_len != 0 ? "/< " : "/ ");
        }
        // If right trimmed text in a comment equals to '/' -- it seems user moves cursor
        // one char left (through space) to add one more '/'
        else if (sc.after.rtrim() == "/")
        {
            // Form a Doxygen comment!
            document.removeText(line, column, line, column + sc.after.length);
            document.insertText(line, column, text_len != 0 ? "< " : " ");
        }
        else if (text_len == 0 && sc.after.length == 0)
        {
            document.insertText(line, column, ' ');
        }
    }
}

/**
 * \brief Maybe '>' needs to be added?
 *
 * Here is a few cases possible:
 * \li user entered <em>"template &gt;</em>
 * \li user entered smth like <em>std::map&gt;</em>
 * \li user wants to output smth to C++ I/O stream by typing <em>&gt;&gt;</em>
 *
 * But, do not add '>' if there some text after cursor.
 */
function tryTemplate(cursor)
{
    var line = cursor.line;
    var column = cursor.column;

    if (isStringOrComment(line, column))
        return;                                             // Do nothing for comments and strings

    // Check for 'template' keyword at line start
    var currentString = document.line(line);
    var prevWord = document.wordAt(line, column - 1);
    dbg("tryTemplate: prevWord='"+prevWord+"'");
    dbg("tryTemplate: prevWord.match="+prevWord.match(/\b[A-Za-z_][A-Za-z0-9_]*/));
    // Add a closing angle bracket if a prev word is not a 'operator'
    // and it looks like an identifier or current line starts w/ 'template' keyword
    var isCloseAngleBracketNeeded = (prevWord != "operator")
      && (currentString.match(/^\s*template\s*<$/) || prevWord.match(/\b[A-Za-z_][A-Za-z0-9_]*/))
      && (column == document.lineLength(line) || document.charAt(cursor).match(/\W/))
      ;
    if (isCloseAngleBracketNeeded)
    {
        document.insertText(cursor, ">");
        view.setCursorPosition(cursor);
    }
    // Add a space after 2nd '<' if a word before is not a 'operator'
    else if (document.charAt(line, column - 2) == '<')
    {
        if (document.wordAt(line, column - 3) != "operator")
        {
            // Looks like case 3... add a space after operator<<
            document.insertText(line, column, " ");
        }
        else
        {
            document.insertText(line, column, "()");
            view.setCursorPosition(line, column + 1);
        }
    }
}

/**
 * \brief Try to align parameters list
 *
 * If (just entered) comma is a first symbol on a line,
 * just move it on a half-tab left relative to a previous line
 * (if latter doesn't starts w/ comma or ':').
 * Do nothing otherwise. A space would be added after it anyway.
 */
function tryComma(cursor)
{
    var result = -2;
    var line = cursor.line;
    var column = cursor.column;

    if (document.firstChar(line) == ',' && document.firstColumn(line) == (column - 1))
    {
        var prevLineFirstChar = document.firstChar(line - 1);
        var mustMove = !(prevLineFirstChar == ',' || prevLineFirstChar == ':');
        result = document.firstColumn(line - 1) - (mustMove ? 2 : 0);
    }
    if (document.charAt(cursor) != ' ')
        document.insertText(cursor, " ");                   // Add space only if not present
    else
        view.setCursorPosition(line, column + 1);           // Otherwise just move cursor after it
    return result;
}

function tryBreakContinue(line, is_break)
{
    var result = -2;
    // Ok, look backward and find a loop/switch statement
    for (; 0 <= line; --line)
    {
        var text = document.line(line).ltrim();
        var is_loop_or_switch = text.startsWith("for ")
          || text.startsWith("do ")
          || text.startsWith("while ")
          || text.startsWith("if ")
          || text.startsWith("else if ")
          ;
        if (is_break)
            is_loop_or_switch =  is_loop_or_switch
              || text.startsWith("case ")
              || text.startsWith("default:")
              ;
        if (is_loop_or_switch)
            break;
    }
    if (line != -1)                                     // Found smth?
        result = document.firstColumn(line) + gIndentWidth;

    return result;
}

function trySemicolon(cursor)
{
    var result = -2;
    var line = cursor.line;
    var column = cursor.column;

    if (document.firstChar(line) == ';' && document.firstColumn(line) == (column - 1))
    {
        // Check if we are inside a `for' statement
        var openBracePos = document.anchor(line, column, '(');
        if (openBracePos.isValid())
        {
            // Add a half-tab relative '('
            result = document.firstColumn(openBracePos.line) + 2;
            document.insertText(cursor, " ");
        }
    }
    else
    {
        var text = document.line(line).ltrim();
        var is_break = text.startsWith("break;");
        var should_proceed = is_break || text.startsWith("continue;")
        if (should_proceed)
        {
            result = tryBreakContinue(line - 1, is_break);
            if (result == -2)
                result = -1;
        }
    }
    return result;
}

function tryOperator(cursor, ch)
{
    var result = -2;
    var line = cursor.line;
    var column = cursor.column;

    var halfTabNeeded = document.firstChar(line) == ch
      && document.firstColumn(line) == (column - 1)
      && document.line(line - 1).search(/^\s*[A-Za-z_][A-Za-z0-9_]*/) != -1
      ;
    dbg("halfTabNeeded=",halfTabNeeded);
    if (halfTabNeeded)
    {
        // check if we r at function call or array index
        var insideBraces = document.anchor(line, document.firstColumn(line), '(').isValid()
          || document.anchor(line, document.firstColumn(line), '[').isValid()
          ;
        dbg("insideBraces=",insideBraces);
        result = document.firstColumn(line - 1) + (insideBraces && ch != '.' ? -2 : 2);
    }
    if (ch == '?')
        document.insertText(cursor, " ");                   // Add space only after '?' of a trenary operator
    return result;
}

/**
 * \brief Try to align a given close bracket
 */
function tryCloseBracket(cursor, ch)
{
    var result = -2;
    var line = cursor.line;
    var column = cursor.column;

    var braceCursor = Cursor.invalid();
    if (ch != '>')
    {
        // TODO Make sure a given `ch` in the gBraceMap
        braceCursor = document.anchor(line, column - 1, gBraceMap[ch]);
        // TODO Otherwise, it seems we have a template parameters list...
    }

    // Check if a given closing brace is a first char on a line
    // (i.e. it is 'dangling' brace)...
    if (document.firstChar(line) == ch && document.firstColumn(line) == (column - 1) && braceCursor.isValid())
    {
        // Move to one half-TAB right, if anything but not closing '}', else
        // align to the corresponding open char
        result = document.firstColumn(braceCursor.line) + (ch != '}' ? 2 : 0);
        dbg("tryCloseBracket: setting result="+result);
    }

    // Check if ';' required after closing '}'
    if (ch == '}' && braceCursor.isValid())
    {
        var is_check_needed = false;
        // Check if corresponding anchor is a class/struct/union/enum,
        // (possible keyword located on same or prev line)
        // and check for trailing ';'...
        var anchoredString = document.line(braceCursor.line);
        dbg("tryCloseBracket: anchoredString='"+anchoredString+"'");
        var regex = /^(\s*)(class|struct|union|enum).*$/;
        var r = regex.exec(anchoredString);
        if (r != null)
        {
            dbg("tryCloseBracket: same line");
            is_check_needed = true;
        }
        else (!is_check_needed && 0 < braceCursor.line)     // Is there any line before?
        {
            dbg("tryCloseBracket: cheking prev line");

            // Ok, lets check it!
            anchoredString = document.line(braceCursor.line - 1);
            dbg("tryCloseBracket: anchoredString-1='"+anchoredString+"'");
            r = regex.exec(anchoredString);
            if (r != null)
            {
                is_check_needed = true;
                dbg("tryCloseBracket: prev line");
            }
        }
        dbg("tryCloseBracket: is_check_needed="+is_check_needed);
        if (is_check_needed)
        {
            var is_ok = document.line(line)
              .substring(column, document.lineLength(line))
              .ltrim()
              .startsWith(';')
              ;
            if (!is_ok)
            {
                document.insertText(line, column, ';');
                view.setCursorPosition(line, column + 1);
            }
        }
    }

    return result;
}

/**
 * \brief Indent new scope block
 *
 * ... try to unindent to be precise... First of all check that open
 * \c '{' is a first symbol on a line, and if it doesn't, make sure
 * there is a space before, except if previous char is not a \c '{'.
 * Otherwise, look at the previous line for dangling <tt>')'</tt> or
 * a line started w/ one of flow control keywords.
 *
 */
function tryBlock(cursor)
{
    var result = -2;
    var line = cursor.line;
    var column = cursor.column;

    // Make sure we r not in a comment or string
    dbg("tryBlock: isStringOrComment(line, column - 2)="+isStringOrComment(line, column - 2))
    if (isStringOrComment(line, column - 2))
        return result;

    if (document.firstColumn(line) == (column - 1) && document.firstChar(line) == '{')
    {
        // Check for a dangling close brace on a previous line
        // (this may mean that `for' or `if' or `while' w/ looong parameters list on it)
        if (document.firstChar(line - 1) == ')')
            result = Math.floor(document.firstColumn(line - 1) / gIndentWidth) * gIndentWidth;
        else
        {
            // Otherwise, check for a keyword on the previous line and
            // indent the started block to it...
            var prevString = document.line(line - 1);
            var r = /^(\s*)((catch|if|for|while)\s*\(|do|else|try|(default|case\s+.*)\s*:).*$/.exec(prevString);
            if (r != null)
                result = r[1].length;
        }
    }
    else
    {
        // '{' is not a first char. Check for previous one...
        if (1 < column)
        {
            var prevChar = document.charAt(line, column - 2);
            dbg("tryBlock: prevChar='"+prevChar+"'");
            if (prevChar != ' ' && prevChar != '{' && prevChar != '(')
                document.insertText(line, column - 1, ' ');
        }
    }
    return result;
}

/**
 * \brief Align preprocessor directives
 */
function tryPreprocessor(cursor)
{
    var result = -2;
    var line = cursor.line;
    var column = cursor.column;

    // Check if just entered '#' is a first on a line
    if (document.firstChar(line) == '#' && document.firstColumn(line) == (column - 1))
    {
        // Get current indentation level
        var currentLevel = getPreprocessorLevelAt(line);
        if (currentLevel > 0)
        {
            var padding = String().fill(' ', (currentLevel - 1) * 2 + 1);
            document.insertText(cursor, padding);
        }
        result = 0;
    }
    return result;
}

/**
 * \brief Try to align access modifiers or class initialization list
 *
 * Here is few cases possible:
 * \li \c ':' pressed after a keyword \c public, \c protected or \c private.
 *     Then align a current line to corresponding class/struct definition.
 *     Check a previous line and if it is not starts w/ \c '{' add a new line before.
 * \li \c ':' is a first char on the line, then it looks like a class initialization
 *     list or 2nd line of trenary operator.
 * \li \c ':' is pressed on a line started w/ \c for statement and after a space
 */
function tryColon(cursor)
{
    var result = -2;
    var line = cursor.line;
    var column = cursor.column;

    // Check if just entered ':' is a first on a line
    if (document.firstChar(line) == ':' && document.firstColumn(line) == (column - 1))
    {
        // Check if there a dangling ')' or '?' (trenary operator) on a previous line
        var ch = document.firstChar(line - 1);
        if (ch == ')' || ch == '?')
            result = document.firstVirtualColumn(line - 1);
        else
            result = document.firstVirtualColumn(line - 1) + 2;
        document.insertText(cursor, " ");
    }
    else
    {
        var currentLine = document.line(line);
        if (currentLine.search(/^\s*((public|protected|private)\s*(slots|Q_SLOTS)?|(signals|Q_SIGNALS)\s*):\s*$/) != -1)
        {
            var definitionCursor = document.anchor(line, 0, '{');
            if (definitionCursor.isValid())
            {
                result = document.firstVirtualColumn(definitionCursor.line);
                dbg("tryColon: result="+result);
                if (0 < line)                               // Is there any line before?
                {
                    // Check if previous line is not empty and not starts w/ '{'
                    var prevLine = document.line(line - 1).trim()
                    if (prevLine.length && !prevLine.startsWith("{"))
                    {
                        // Cuz a new line will be added in place of current, returning
                        // result will not affect indentation. So do it manually.
                        var firstColumn = document.firstColumn(line);
                        var padding = "";
                        if (firstColumn < result)
                            padding = String().fill(' ', result - firstColumn);
                        else if (result < firstColumn)
                            document.removeText(line, 0, line, firstColumn - result);
                        // Add an empty line before the current
                        document.insertText(line, 0, "\n" + padding);
                        result = 0;
                    }
                }
            }
        }
        else if (document.charAt(line, column - 2) == ' ' && currentLine.ltrim().startsWith("for ("))
        {
            // Looks like a range based `for'!
            // Add a space after ':'
            document.insertText(line, column, " ");
        }
    }
    return result;
}

/**
 * \brief Try to add one space after keywords and before an open brace
 */
function tryOpenBrace(cursor)
{
    var line = cursor.line;
    var column = cursor.column;
    var wordBefore = document.wordAt(line, column - 1);
    dbg("word before: '"+wordBefore+"'");
    if (wordBefore.search(/\b(catch|for|if|switch|while|return)\b/) != -1)
        document.insertText(line, column - 1, " ");
}

function getMacroRange(line)
{
    function stripLastCharAndRTrim(str)
    {
        return str.substring(0, str.length - 1).rtrim();
    }
    var maxLength = 0;
    var macroStartLine = -1;
    // Look up towards begining of a document
    for (var i = line; i >= 0; --i)
    {
        var currentLineText = document.line(i);
        dbg("up: '"+currentLineText+"'");
        if (currentLineText.search(/^\s*#\s*define\s+.*\\$/) != -1)
        {
            macroStartLine = i;
            maxLength = Math.max(maxLength, stripLastCharAndRTrim(currentLineText).length);
            break;                                          // Ok, we've found the macro start!
        }
        else if (currentLineText.search(/\\$/) == -1)
            break;                                          // Oops! No backslash found and #define still not reached!
        maxLength = Math.max(maxLength, stripLastCharAndRTrim(currentLineText).length);
    }

    if (macroStartLine == -1)
        return null;

    // Look down towards end of the document
    var macroEndLine = -1;
    for (var i = line; i < document.lines(); ++i)
    {
        var currentLineText = document.line(i);
        dbg("dw: '"+currentLineText+"'");
        if (currentLineText.search(/\\$/) != -1)            // Make sure the current line have a '\' at the end
        {
            macroEndLine = i;
            maxLength = Math.max(maxLength, stripLastCharAndRTrim(currentLineText).length);
        }
        else break;                                         // No backslash at the end --> end of macro!
    }

    if (macroEndLine == -1)
        return null;

    macroEndLine++;
    return {
        range: new Range(macroStartLine, 0, macroEndLine, 0)
      , max: maxLength
      };
}

/**
 * \brief Try to align a backslashes in macro definition
 *
 * \note It is \b illegal to have smth after a backslash in source code!
 */
function tryBackslash(cursor)
{
    var line = cursor.line;
    var result = getMacroRange(line);                       // Look up and down for macro definition range
    if (result != null)
    {
        dbg("macroRange:",result.range);
        dbg("maxLength:",result.max);
        // Iterate over macro definition, strip backslash
        // and add a padding string up to result.max length + backslash
        document.editBegin();
        for (var i = result.range.start.line; i < result.range.end.line; ++i)
        {
            var currentLineText = document.line(i);
            var originalTextLength = currentLineText.length;
            currentLineText = currentLineText.substring(0, currentLineText.length - 1).rtrim();
            var textLength = currentLineText.length;
            document.removeText(i, textLength, i, originalTextLength);
            document.insertText(i, textLength, String().fill(' ', result.max - textLength + 1) + "\\");
        }
        document.editEnd();
    }
}

/**
 * \brief Handle a <tt>@</tt> symbol
 *
 * Possible user wants to add a Doxygen group
 */
function tryDoxygenGrouping(cursor)
{
    var line = cursor.line;
    var column = cursor.column;
    var firstColumn = document.firstColumn(line);
    // Check the symbol before the just entered
    var looks_like_doxgorup = isStringOrComment(line, column - 2)// ")
      && firstColumn == (column - 4)
      && document.line(line).ltrim().startsWith("// ")
      ;
    if (looks_like_doxgorup)
    {
        document.removeText(line, column - 2, line, column - 1);
        var padding = String().fill(' ', firstColumn);
        document.insertText(line, column - 1, "{\n" + padding + "\n" + padding + "//@}");
        view.setCursorPosition(line + 1, document.lineLength(line + 1));
    }
}

/**
 * \brief Handle a space
 *
 * Add '()' pair after some keywords like: \c if, \c while, \c for, \c switch
 */
function tryKeywordsWithBrackets(cursor)
{
    var line = cursor.line;
    var column = cursor.column;
    var text = document.line(line).ltrim();
    dbg("text="+text);
    var need_brackets = text == "if "
      || text == "else if "
      || text == "while "
      || text == "for "
      || text == "switch "
      ;
    if (need_brackets)
    {
        document.insertText(cursor, "()");
        view.setCursorPosition(line, column + 1);
    }
}

/**
 * \brief Process one character
 *
 * NOTE Cursor positioned right after just entered character and has +1 in column.
 *
 */
function processChar(line, ch)
{
    var result = -2;                                        // By default, do nothing...
    var cursor = view.cursorPosition();
    if (!cursor)
        return result;

    // TODO Is there any `assert' in JS?
    if (line != cursor.line)
    {
        dbg("ASSERTION FAILURE: line != cursor.line");
        return result;
    }

    var column = cursor.column;

    switch (ch)
    {
        case '\n':
            result = caretPressed(cursor);
            break;
        case '/':
            trySameLineComment(cursor);                     // Possible user wants to start a comment
            break;
        case '<':
            tryTemplate(cursor);                            // Possible need to add closing '>' after template
            break;
        case ',':
            result = tryComma(cursor);                      // Possible need to align parameters list
            break;
        case ';':
            result = trySemicolon(cursor);                  // Possible `for ()` loop speaded on few lines
            break;
        case '?':
        case '|':
        case '%':
        case '/':                                           // TODO Useless! Code review needed.
        case '.':
            result = tryOperator(cursor, ch);               // Possible need to align some operator
            break;
        case '}':
        case ')':
        case ']':
        case '>':
            result = tryCloseBracket(cursor, ch);           // Try to align a given close bracket
            break;
        case '{':
            result = tryBlock(cursor);
            break;
        case '#':
            result = tryPreprocessor(cursor);
            break;
        case ':':
            result = tryColon(cursor);
            break;
        case '(':
            tryOpenBrace(cursor);
            break;
        case '\\':
            tryBackslash(cursor);
            break;
        case '@':
            tryDoxygenGrouping(cursor);
            break;
        case ' ':
            tryKeywordsWithBrackets(cursor);
            break;
        default:
            break;                                          // Nothing to do...
    }

    return result;
}

function alignPreprocessor(line)
{
    if (tryPreprocessor_ch(line) == -1)                     // Is smth happened?
        return -2;                                          // No! Signal to upper level to try next aligner...
    return 0;                                               // NOTE preprocessor directives always aligned to 0!
}

/**
 * Try to find a next non comment line assuming that a given
 * one is a start or middle of a multiline comment.
 *
 * \attention This function would ignore anything else than
 * a simple comments like this one... I.e. if \b right after
 * star+slash starts anything (non comment, or even maybe after
 * that another one comment begins), it will be \b IGNORED.
 * (Just because this is a damn ugly style!)
 *
 * \return line number or \c 0 if not found
 * \note \c 0 is impossible value, so suitable to indicate an error!
 *
 * \sa \c alignInsideBraces()
 */
function findMultiLineCommentBlockEnd(line)
{
    for (; line < document.lines(); line++)
    {
        var text = document.line(line).rtrim();
        if (text.endsWith("*/"))
            break;
    }
    line++;                                                 // Move to *next* line
    if (line < document.lines())
    {
        // Make sure it is not another one comment, and if so,
        // going to find it's end as well...
        var currentLineText = document.line(line).ltrim();
        if (currentLineText.startsWith("//"))
            line = findSingleLineCommentBlockEnd(line);
        else if (currentLineText.startsWith("/*"))
            line = findMultiLineCommentBlockEnd(line);
    }
    else line = 0;                                          // EOF found
    return line;
}

/**
 * Try to find a next non comment line assuming that a given
 * one is a single-line one
 *
 * \return line number or \c 0 if not found
 * \note \c 0 is impossible value, so suitable to indicate an error!
 *
 * \sa \c alignInsideBraces()
 */
function findSingleLineCommentBlockEnd(line)
{
    while (++line < document.lines())
    {
        var text = document.line(line).ltrim();
        if (text.length == 0) continue;                     // Skip empty lines...
        if (!text.startsWith("//")) break;                  // Yeah! Smth was found finally.
    }
    if (line < document.lines())
    {
        var currentLineText = document.line(line).ltrim();  // Get text of the found line
        while (currentLineText.length == 0)                 // Skip empty lines if any
            currentLineText = document.line(++line).ltrim();
        // Make sure it is not another one multiline comment, and if so,
        // going to find it's end as well...
        if (currentLineText.startsWith("/*"))
            line = findMultiLineCommentBlockEnd(line);
    }
    else line = 0;                                          // EOF found
    return line;
}

/**
 * Almost anything in a code is placed whithin some brackets.
 * So the ideas is simple:
 * \li find nearest open bracket of any kind
 * \li depending on its type and presence of leading delimiters (non identifier charscters)
 *     add one or half TAB relative a first non-space char of a line w/ found bracket.
 *
 * But here is some details:
 * \li do nothing on empty lines
 * \li do nothing if first position is a \e string
 * \li align comments according next non-comment and non-preprocessor line
 *     (i.e. it's desired indent cuz it maybe still unaligned)
 *
 * \attention Current Kate version has a BUG: \c anchor() unable to find smth
 * in a multiline macro definition (i.e. where every line ends w/ a backslash)!
 */
function alignInsideBraces(line)
{
    // Make sure there is a text on a line, otherwise nothing to align here...
    var thisLineIndent = document.firstColumn(line);
    if (thisLineIndent == -1 || document.isString(line, 0))
        return 0;

    // Check for comment on the current line
    var currentLineText = document.line(line).ltrim();
    var nextNonCommentLine = -1;
    var middleOfMultilineBlock = false;
    var isSingleLineComment = false;
    if (currentLineText.startsWith('//'))                   // Is single line comment on this line?
    {
        dbg("found a single-line comment");
        // Yep, go to find a next non-comment line...
        nextNonCommentLine = findSingleLineCommentBlockEnd(line);
        isSingleLineComment = true;
    }
    else if (currentLineText.startsWith('/*'))              // Is multiline comment starts on this line?
    {
        // Yep, go to find a next non-comment line...
        dbg("found start of a multiline comment");
        nextNonCommentLine = findMultiLineCommentBlockEnd(line);
    }
    // Are we already inside of a multiline comment?
    // NOTE To be sure that we are not inside of #if0/#endif block,
    // lets check that current line starts w/ '*' also!
    // NOTE Yep, it is expected (hardcoeded) that multiline comment has
    // all lines strarted w/ a star symbol!
    // TODO BUG Kate has a bug: when multiline code snippet gets inserted into
    // a multiline comment block (like Doxygen's @code/@endcode)
    // document.isComment() returns true *only& for the first line of it!
    // So some other way needs to be found to indent comments properly...
    // TODO DAMN... it doesn't work that way also... for snippets longer than 2 lines.
    // I suppose kate first insert text, then indent it, and after that highlight it
    // So indenters based on a higlighting info will not work! BUT THEY DEFINITELY SHOULD!
    else if (currentLineText.startsWith("*") && document.isComment(line, 0))
    {
        dbg("found middle of a multiline comment");
        // Yep, go to find a next non-comment line...
        nextNonCommentLine = findMultiLineCommentBlockEnd(line);
        middleOfMultilineBlock = true;
    }
    dbg("line="+line);
    dbg("document.isComment(line, 0)="+document.isComment(line, 0));
    //dbg("document.defStyleNum(line, 0)="+document.defStyleNum(line-1, 0));
    dbg("currentLineText='"+currentLineText+"'");
    dbg("middleOfMultilineBlock="+middleOfMultilineBlock);

    if (nextNonCommentLine == 0)                            // End of comment not found?
        // ... possible due temporary invalid code...
        // anyway, dunno how to align it!
        return -2;
    // So, are we inside a comment? (and we know where it ends)
    if (nextNonCommentLine != -1)
    {
        // Yep, lets try to get desired indent for next non-comment line
        var desiredIndent = indentLine(nextNonCommentLine);
        if (desiredIndent < 0)
        {
            // Have no idea how to indent this comment! So try to align it
            // as found line:
            desiredIndent = document.firstColumn(nextNonCommentLine);
        }
        // TODO Make sure that next non-comment line do not starts
        // w/ 'special' chars...
        return desiredIndent + (middleOfMultilineBlock|0);
    }

    var brackets = [
        document.anchor(line, document.firstColumn(line), '(')
      , document.anchor(line, document.firstColumn(line), '{')
      , document.anchor(line, document.firstColumn(line), '[')
      ].sort();
    dbg("Found open brackets @ "+brackets);

    // Check if we are at some brackets, otherwise do nothing
    var nearestBracket = brackets[brackets.length - 1];
    if (!nearestBracket.isValid())
        return 0;

    // Make sure it is not a `namespace' level
    // NOTE '{' brace should be at the same line w/ a 'namespace' keyword
    // (yep, according my style... :-)
    var bracketChar = document.charAt(nearestBracket);
    var parentLineText = document.line(nearestBracket.line).ltrim();
    if (bracketChar == '{' && parentLineText.startsWith("namespace"))
        return 0;

    // Ok, (re)align it!
    var result = -2;
    switch (bracketChar)
    {
        case '{':
        case '(':
        case '[':
            // If current line has some leading delimiter, i.e. non alphanumeric character
            // add a half-TAB, otherwise add a one TAB... if needed!
            var parentIndent = document.firstColumn(nearestBracket.line);
            var openBraceIsFirst = parentIndent == nearestBracket.column;
            var firstChar = document.charAt(line, thisLineIndent);
            var isCloseBraceFirst = firstChar == ')' || firstChar == ']' || firstChar == '}';
            var doNotAddAnything = openBraceIsFirst && isCloseBraceFirst;
            var mustAddHalfTab = (!openBraceIsFirst && isCloseBraceFirst)
              || firstChar == ','
              || firstChar == '?'
              || firstChar == ':'
              || firstChar == ';'
              ;
            var desiredIndent = parentIndent + (
                mustAddHalfTab
              ? 2
              : (doNotAddAnything ? 0 : gIndentWidth)
              );
            result = desiredIndent;                         // Reassign a result w/ desired value!
            //BEGIN SPAM
            dbg("parentIndent="+parentIndent);
            dbg("openBraceIsFirst="+openBraceIsFirst);
            dbg("firstChar="+firstChar);
            dbg("isCloseBraceFirst="+isCloseBraceFirst);
            dbg("doNotAddAnything="+doNotAddAnything);
            dbg("mustAddHalfTab="+mustAddHalfTab);
            dbg("desiredIndent="+desiredIndent);
            //END SPAM
            break;
        default:
            dbg("Dunno how to align this line...");
            break;
    }
    return result;
}

function alignAccessSpecifier(line)
{
    var result = -2;
    var currentLineText = document.line(line).ltrim();
    var match = currentLineText.search(
        /^\s*((public|protected|private)\s*(slots|Q_SLOTS)?|(signals|Q_SIGNALS)\s*):\s*$/
      );
    if (match != -1)
    {
        // Ok, lets find an open brace of the `class'/`struct'
        var openBracePos = document.anchor(line, document.firstColumn(line), '{');
        if (openBracePos.isValid())
            result = document.firstColumn(openBracePos.line);
    }
    return result;
}

/**
 * Try to align \c case statements in a \c switch
 */
function alignCase(line)
{
    var result = -2;
    var currentLineText = document.line(line).ltrim();
    if (currentLineText.startsWith("case ") || currentLineText.startsWith("default:"))
    {
        // Ok, lets find an open brace of the `switch'
        var openBracePos = document.anchor(line, document.firstColumn(line), '{');
        if (openBracePos.isValid())
            result = document.firstColumn(openBracePos.line) + gIndentWidth;
    }
    return result;
}

/**
 * Try to align \c break or \c continue statements in a loop or \c switch.
 *
 * Also it take care about the following case:
 * \code
 *  for (blah-blah)
 *  {
 *      if (smth)
 *          break;
 *  }
 * \endcode
 */
function alignBreakContinue(line)
{
    var result = -2;
    var currentLineText = document.line(line).ltrim();
    var is_break = currentLineText.startsWith("break;");
    var should_proceed = is_break || currentLineText.startsWith("continue;")
    if (should_proceed)
        result = tryBreakContinue(line - 1, is_break);
    return result;
}

/**
 * Try to align a given line
 * \todo More actions
 */
function indentLine(line)
{
    dbg(">> Going to indent line "+line);
    var result = alignPreprocessor(line);                   // Try to align a preprocessor directive
    if (result == -2)                                       // Nothing has changed?
        result = alignAccessSpecifier(line);                // Try to align access specifiers in a class
    if (result == -2)                                       // Nothing has changed?
        result = alignCase(line);                           // Try to align `case' statements in a `switch'
    if (result == -2)                                       // Nothing has changed?
        result = alignBreakContinue(line);                  // Try to align `break' or `continue' statements
    if (result == -2)                                       // Nothing has changed?
        result = alignInsideBraces(line);                   // Try to align a generic line
    alignInlineComment(line);                               // Always try to align inline comments

    dbg("indentLine result="+result);

    if (result == -2)                                       // Still dunno what to do?
        result = -1;                                        // ... just align according a previous non empty line
    return result;
}

/**
 * \brief Process a newline or one of \c triggerCharacters character.
 *
 * This function is called whenever the user hits \c ENTER key.
 *
 * It gets three arguments: \c line, \c indentwidth in spaces and typed character
 *
 * Called for each newline (<tt>ch == \n</tt>) and all characters specified in
 * the global variable \c triggerCharacters. When calling \e Tools->Align
 * the variable \c ch is empty, i.e. <tt>ch == ''</tt>.
 */
function indent(line, indentWidth, ch)
{
    // NOTE Update some global variables
    gIndentWidth = indentWidth;
    gMode = document.highlightingModeAt(view.cursorPosition());
    gAttr = document.attributeName(view.cursorPosition());

    dbg("indentWidth: " + indentWidth);
    dbg("      gMode: " + gMode);
    dbg("      gAttr: " + gAttr);
    dbg("       line: " + line);
    dbg("         ch: '" + ch + "'");

    if (ch != "")
        return processChar(line, ch);

    return indentLine(line);
}

/**
 * \todo Better to use \c defStyleNum() instead of \c attributeName() and string comparision
 */

// kate: space-indent on; indent-width 4; replace-tabs on;

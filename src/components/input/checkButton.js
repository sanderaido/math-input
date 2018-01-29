/**
 * Created by aido on 17/11/2017.
 */

const React = require('react');
const ReactDOM = require('react-dom');

var CheckMathButton = React.createClass({
    getInitialState: function() {
        return {
            counter: 0
        };
    },

    getDefaultProps() {
        return {
            data: "",
        };
    },

    checkContent: function (props) {


        if(props.data.props){
            // TODO siin peaks kontrollima eval-expr teegiga, kas väärtus on sama mis arvutatud vastus, hetkel üks hard-coded proov
            if(props.data.props.value == 'x^2-2xy+y^2'){
                document.getElementById("vastus").style.display = 'block';
            }
            console.log(props.data.props.value);
        }
    },

    render: function() {
        return <div>
            <button onClick={this.checkContent(this.props)}>Check</button>
        </div>;
    }
});

module.exports = CheckMathButton;
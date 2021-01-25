//unprocessedPaths: An array of SVG-paths in absolute coordinates
//maxSVGelements: An integer specifying the maximum number of paths of the array to process
//maxSubpaths: Within each SVG path, there may be several subpaths following each "M".
//             This integer specifies the maximum number of subpaths to return.
//Returns an array of arrays of coordinates
function getPaths(unprocessedPaths, maxSVGelements, maxSubpaths) {
    console.log(unprocessedPaths);
    var paths = [];
    var INDEX = 0;
    while (INDEX < Math.min(maxSVGelements, unprocessedPaths.length)) {
        var processed = unprocessedPaths[INDEX].outerHTML.split("d=\"")[1];
        processed = processed.split("\"")[0];
        //now, in processed, remove occurrences of "L +number" and "V+number"
        var occr = processed.indexOf("V");
        while (occr != -1) {
            var endIndex = occr+1;
            while (processed.charAt(endIndex)==" ")
                endIndex++;
            while (processed.charAt(endIndex) != " ")
                endIndex++;
            processed = processed.replace(processed.substring(occr,endIndex),"");
            var occr = processed.indexOf("V");
        }

        var occr = processed.indexOf("H");
        while (occr != -1) {
            var endIndex = occr+1;
            while (processed.charAt(endIndex)==" ")
                endIndex++;
            while (processed.charAt(endIndex) != " ")
                endIndex++;
        processed = processed.replace(processed.substring(occr,endIndex),"");
            var occr = processed.indexOf("H");
        }


        var subpaths = processed.split("M");
        for (var i = 1; i < Math.min(maxSubpaths, subpaths.length); i++) {
            var tempPath = subpaths[i].match(/[0-9\.]+/g);
            for (var j = 0; j <= tempPath.length % 1000; j++) {
                var sliced = tempPath.slice(j*1000, (j+1)*1002);
                if (sliced.length > 0) {
                    paths.push(sliced);
                }
                    
            }

        }

    INDEX++;
    }
    return paths;
}
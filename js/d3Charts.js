const colors = {
    N: "#00897B",
    NS: "#00897BB3",
    S: "#7E3F8F",
    I: "#6B7280",
    F: "#6B7280",
    Labour: "#E4003B",
    Liberal: "#FAA61A",
    Conservative: "#0087DC",
    Tory: "#0087DCB3",
    Peelite: "#FAA61AB3",
    Whig: "#FAA61AB3",
    W: "#FFFFFF", // White
    Bk: "#111111", // Black
    MidGy: "#A8ADB6",
    Gy: "#E5E7EB" // Light grey
};

const headerMenuHeight = 340;

const measureWidth = (text, fontSize) => {
    const context = document.createElement("canvas").getContext("2d");
    context.font = `${fontSize}px Arial`;
    return context.measureText(text).width;
}

const isNorthern = (d) => window.includeScotland ? d.Location === "N" || d.Location === "NS" : d.Location === "N";

const drawChart = (div, data, width, windowHeight, transitionTime) => {

    const isMobile = width < 800;
    const viewType = window.viewType || 'home';

    let svg = div.select(".chartSvg");
    let chartHeight = windowHeight - headerMenuHeight;

    // append non data dependent elements
    if (svg.empty()) {
        svg = div.append("svg").attr("class", "noselect chartSvg");
        svg.append("rect").attr("class", "northBackRect");
        svg.append("rect").attr("class", "southBackRect");
        const northLabel = svg.append("text").attr("class", "northLabel");
        northLabel.append("tspan").attr("class", "northLabelPercent")
        northLabel.append("tspan").attr("class", "northLabelText")
        northLabel.append("tspan").attr("class", "northLabelNorth")

        const southLabel = svg.append("text").attr("class", "southLabel");
        southLabel.append("tspan").attr("class", "southLabelPercent")
        southLabel.append("tspan").attr("class", "southLabelText")
        southLabel.append("tspan").attr("class", "southLabelSouth")
        southLabel.append("tspan").attr("class", "southLabelText2")
        southLabel.append("tspan").attr("class", "southLabelElsewhere")
        svg.append("g").attr("class", "xAxisTime");
    }
    // size svg
    svg.attr("width", `${width}px`)
        .attr("height", `${chartHeight}px`)
    // key variables
    const {primeMinisters} = data;
    const dotRadius = width < 450 ? 15.5 : 19;
    const labelHeight = 30;
    const dotHeight = dotRadius * 2.5;
    const rectExtra = dotHeight * 0.25;
    let margin = {labelTop: dotRadius * 2, label: 140, left: 15, right: 15, top: dotRadius * 5, bottom: 25};
    const yearExtent = d3.extent(primeMinisters, (d) => d.midYear);

    // group by minParty (Con, Lab or Lib) - for party view
    const byPartyNorth = [
        ...d3.group(
            primeMinisters.filter(isNorthern),
            (d) =>
                d.minParty
        )
    ]

    const byPartySouth = [
        ...d3.group(
            primeMinisters.filter((f) => !isNorthern(f)),
            (d) => d.minParty
        )
    ]
    // the data sorts naturally into 10 or 20 year bins depending on the width
    // mobile view goes vertical so switches back to 10 year bins as we now have space
    const binBig = 30;
    const binThresholdWidth = dotHeight * (binBig + 1.25);
    const binThresholds = isMobile || (width - margin.left - margin.right) > binThresholdWidth ? 30 : 16;

    const isTimeSmall = (viewType === 'byTime' || viewType === 'byParty') && isMobile;
    // adjust margins for time view
    let timeThresholdWidth = binThresholdWidth;
    if (binThresholds === 16 && viewType === 'byTime') {
        timeThresholdWidth = dotHeight * 17.25;
    }
    // adjusts container width for time view
    const divContainerWidth = viewType === 'byTime' && !isMobile ? timeThresholdWidth : window.innerWidth;
    const {clientWidth: currentWidth} = div;
    if (currentWidth !== divContainerWidth) {
        d3.select(".divContainer").style("width", `${divContainerWidth}px`);
        width = divContainerWidth;
        svg.attr("width", `${width}px`);
    }

    const chartWidth = width - margin.left - margin.right;
    const dotsPerRow = Math.floor(chartWidth / dotHeight) - 1;

    // node bins - for by time view
    const nodeBinsNorth = d3
        .bin()
        .domain([yearExtent[0] || 0, yearExtent[1] || 0])
        .thresholds(binThresholds)
        .value((d) => d.midYear || 0)(
            primeMinisters.filter(isNorthern)
        )
    const nodeBinsSouth = d3
        .bin()
        .domain([yearExtent[0] || 0, yearExtent[1] || 0])
        .thresholds(binThresholds)
        .value((d) => d.midYear || 0)(
            primeMinisters.filter((f) => !isNorthern(f))
        )

    // byLocation - for home view
    const byLocation = [
        ...d3.group(primeMinisters, (g) =>
            isNorthern(g) ? "North" : "Other"
        )
    ]
    // for time xScale
    const timeBandWidth = (viewType === 'byTime' ? dotHeight : dotHeight * 0.75) * (binThresholds - 1);

    // calculate party positions - could optimise to only run on
    const getPartyPositions = () => {
        const padding = dotRadius;
        const partyType = byPartyNorth.map((m) => m[0]);
        // get max rows for each party
        const partyMax = partyType.map((m) => ({
            party: m,
            max: Math.max(
                byPartyNorth.find((f) => f[0] === m)[1].length,
                byPartySouth.find((f) => f[0] === m)[1].length
            )
        }));

        const maxTotal = d3.sum(partyMax, (s) => s.max);
        let propAcc = 0;
        let totalWidth =
            width - margin.left - margin.right - padding * partyType.length;
        if (isMobile) {
            totalWidth = timeBandWidth;
        }
        // loop through and assign relative party position
        // Conservative + Liberal were so much bigger than label that this fitted better than a standard
        // band scale
        return partyMax.reduce((acc, entry) => {
            const prop = entry.max / maxTotal;
            const partyWidth = totalWidth * prop;
            acc.push({
                party: entry.party,
                partyWidth,
                partyX: propAcc,
                labelX: propAcc + partyWidth / 2,
                prop
            });
            propAcc += partyWidth + padding;
            return acc;
        }, []);
    }
    const partyPositions = getPartyPositions();

    // now reduce the location data and calculate positions for all view types
    // could be optimised so only runs if needed
    const pmPositioned = byLocation.reduce((acc, entry) => {
        const isSouth = entry[0] === "Other";
        const matchingBinArray = isSouth ? nodeBinsSouth : nodeBinsNorth;
        const byParty = isSouth ? byPartySouth : byPartyNorth;
        const yMultiple = isSouth ? dotHeight : -dotHeight;

        entry[1].forEach((e, i) => {
            const matchingBin = matchingBinArray.find((f) =>
                f.some((s) => s.photoName === e.photoName)
            );
            const matchingBinIndex = matchingBinArray.findIndex(
                (f) => f.x0 === matchingBin.x0
            );
            const binValuesIndex =
                matchingBin.findIndex((f) => f.photoName === e.photoName) - 1;

            const partyPosition = partyPositions.find((f) => f.party === e.minParty);
            const partyGroup = byParty.find((f) => f[0] === e.minParty);
            const partyIndex = partyGroup[1].findIndex(
                (f) => f.photoName === e.photoName
            );
            const partyDotsPerRow = Math.floor(partyPosition.partyWidth / (dotRadius * 2.5));

            // returns 'waffle chart' style calculated positions depending on chart type
            // the small version simply flips the axes
            acc.push({
                homePos: {
                    x: (i % dotsPerRow) * dotHeight,
                    y: Math.floor(i / dotsPerRow) * dotHeight,
                    xCount: (i % dotsPerRow) + 1,
                    row: Math.floor(i / dotsPerRow) + 1
                },
                timePos: {
                    x: dotHeight * matchingBinIndex,
                    y: yMultiple * (binValuesIndex + 1),
                    xCount: matchingBinIndex + 1,
                    row: binValuesIndex + 1
                },
                timePosSmall: {
                    y: dotHeight * matchingBinIndex,
                    x: yMultiple * (binValuesIndex + 1),
                    row: matchingBinIndex + 1,
                    xCount: binValuesIndex + 1
                },
                partyPos: {
                    x:
                        partyPosition.partyX +
                        (partyIndex % partyDotsPerRow) * dotHeight,
                    y: Math.floor(partyIndex / partyDotsPerRow) * yMultiple,
                    xCount: partyIndex + 1,
                    row: Math.floor(partyIndex / partyDotsPerRow) + 1
                },
                partyPosSmall: {
                    y:
                        partyPosition.partyX +
                        (partyIndex % partyDotsPerRow) * dotHeight,
                    x: Math.floor(partyIndex / partyDotsPerRow) * yMultiple,
                    row: partyIndex + 1,
                    xCount: Math.floor(partyIndex / partyDotsPerRow) + 1
                },
                r: dotRadius,
                photo: `images/${e.photoName}`,
                photoName: e.photoName,
                data: e,
                isSouth
            });
        });
        return acc;
    }, [])

    // fetches the appropriate position depending on viewType and isMobile
    const getPos = (d) => {
        if (viewType === "home") return d.homePos;
        if (viewType === "byTime") {
            if (isMobile) return d.timePosSmall;
            return d.timePos;
        }
        if (isMobile) return d.partyPosSmall;
        return d.partyPos
    };

    const getMaxNorth = () => {
        if (viewType === 'byTime') return d3.max(nodeBinsNorth, (d) => d.length);
        // if(viewType === 'byParty') return d3.max(byPartyNorth, (d) => d[1].length);
        return d3.max(pmPositioned.filter((f) => !f.isSouth), (d) => getPos(d).row)
    }

    const getMaxSouth = () => {
        if (viewType === 'byTime') return d3.max(nodeBinsSouth, (d) => d.length);
        //  if(viewType === 'byParty') return d3.max(byPartySouth, (d) => d[1].length);
        return d3.max(pmPositioned.filter((f) => f.isSouth), (d) => getPos(d).row)
    }

    // calculate the height + label strings for the North/South rectangles and labels
    const northHeight = rectExtra + getMaxNorth() * dotHeight;
    const southStart = northHeight + (labelHeight * (viewType === 'byTime' ? 2 : 3));
    const southHeight = rectExtra + getMaxSouth() * dotHeight;

    const timeSmallAxisWidth = labelHeight * 1.5
    const timeWidth = (chartWidth - timeSmallAxisWidth) / 2;
    const timeSouthLeft = timeWidth + timeSmallAxisWidth;

    const newChartHeight = southStart + southHeight + margin.top + margin.bottom;
    // adapts the chart height if needed
    if (newChartHeight > chartHeight) {
        chartHeight = newChartHeight;
    }

    svg.attr("height", `${chartHeight}px`);
    if (isTimeSmall) {
        svg.attr("height", `${timeBandWidth + margin.top + margin.bottom}px`);
    }

    const totalNorth = primeMinisters.filter(isNorthern);
    const northProp = totalNorth.length / primeMinisters.length;
    const southProp = 1 - northProp;
    const fontSizeBig = isMobile ? 18 : 24;
    const fontSizeSmall = isMobile ? 14 : 16;

    const northPercentVal = d3.format(".0%")(northProp);

    const bornText = width < 600 ? " " : " born in the ";

    // svg text elements are separated into tspan's to allow different word styling
    const northWidth = measureWidth(northPercentVal, fontSizeBig)
        + measureWidth(bornText, fontSizeSmall)
        + measureWidth("North", fontSizeBig);

    svg.select(".northLabel")
        .style("dominant-baseline", "baseline")
        .attr("x", isTimeSmall ? timeWidth + rectExtra - northWidth : (width - northWidth) / 2)
        .attr("y", margin.labelTop + labelHeight - 6)
        .attr("fill", colors.MidGy)

    svg.select(".northLabelPercent")
        .attr("fill", colors.Bk)
        .attr("font-size", fontSizeBig)
        .text(northPercentVal);

    svg.select(".northLabelText")
        .attr("font-size", fontSizeSmall)
        .text(bornText);

    svg.select(".northLabelNorth")
        .attr("text-anchor", "start")
        .attr("font-size", fontSizeBig)
        .attr("fill", colors.N)
        .text("North");

    svg.select(".northBackRect")
        .attr("fill", colors.N)
        .attr("fill-opacity", 0.1)
        .attr("rx", 5)
        .attr("ry", 5)
        .attr("x", margin.left)
        .attr("y", margin.labelTop + labelHeight)
        .attr("width", isTimeSmall ? timeWidth : chartWidth)
        .attr("height", isTimeSmall ? timeBandWidth + dotHeight : northHeight);

    const southPercentVal = d3.format(".0%")(southProp);

    const southWidth = measureWidth(southPercentVal, fontSizeBig)
        + measureWidth(bornText, fontSizeSmall)
        + measureWidth("South", fontSizeBig)
        + measureWidth(" or ", fontSizeSmall)
        + measureWidth("Elsewhere", fontSizeBig);

    svg.select(".southLabel")
        .style("dominant-baseline", "baseline")
        .attr("x", isTimeSmall ? timeSouthLeft + rectExtra : (width - southWidth) / 2)
        .attr("y", margin.labelTop + (isTimeSmall ? labelHeight - 6 : southStart - 6 +
            (viewType === "byTime" || viewType === 'byParty' ? southHeight + labelHeight : 0)))
        .attr("fill", colors.MidGy)


    svg.select(".southLabelPercent")
        .attr("font-size", fontSizeBig)
        .attr("fill", colors.Bk)
        .text(southPercentVal);

    svg.select(".southLabelText")
        .attr("font-size", fontSizeSmall)
        .text(bornText);

    svg.select(".southLabelSouth")
        .attr("text-anchor", "start")
        .attr("font-size", fontSizeBig)
        .attr("fill", colors.S)
        .text("South");

    svg.select(".southLabelText2")
        .attr("font-size", fontSizeSmall)
        .text(" or ");

    svg.select(".southLabelElsewhere")
        .attr("text-anchor", "start")
        .attr("font-size", fontSizeBig)
        .attr("fill", colors.I)
        .text("Elsewhere");

    svg.select(".southBackRect")
        .attr("fill", colors.S)
        .attr("fill-opacity", 0.1)
        .attr("rx", 5)
        .attr("ry", 5)
        .attr("x", margin.left + (isTimeSmall ? timeSouthLeft : 0))
        .attr("y", margin.labelTop + (isTimeSmall ? labelHeight : southStart))
        .attr("width", isTimeSmall ? timeWidth : chartWidth)
        .attr("height", isTimeSmall ? timeBandWidth + dotHeight : southHeight);

    const circleRowNorth = [...d3.rollup(
        pmPositioned.filter((f) => !f.isSouth),
        (v) => v.length,
        (g) => getPos(g).row
    )]
    const circleRowSouth = [...d3.rollup(
        pmPositioned.filter((f) => f.isSouth),
        (v) => v.length,
        (g) => getPos(g).row
    )];

    // for viewType home, centre pmCircles within their horizontal space
    pmPositioned.map((m) => {
        const position = getPos(m);
        const circleRow = m.isSouth ? circleRowSouth : circleRowNorth;
        const rowCircles = circleRow.find((f) => f[0] === position.row);
        const xMargin = chartWidth - ((rowCircles[1] - 1) * dotHeight);
        let extraX = xMargin / 2;
        if (viewType === "byTime" || viewType === "byParty") {
            extraX = dotHeight * 0.75;
        }
        m.extraX = extraX;
    })

    // x axis - by time only, flips vertical for isMobile
    const xScaleTimeBands = nodeBinsNorth.map((m, i) => i);
    const xAxisTime = svg.select(".xAxisTime");
    const timeXScale = d3.scalePoint().padding(0).domain(xScaleTimeBands).range([0, timeBandWidth]);

    xAxisTime
        .attr("display", viewType === "byTime" ? "block" : "none")
        .call(d3[isMobile ? 'axisLeft' : 'axisBottom'](timeXScale).tickSizeOuter(0).tickValues(xScaleTimeBands))
        .attr(
            "transform",
            `translate(${isMobile ? width / 2 : margin.left + dotRadius * 1.9},${
                isMobile ? margin.top : southStart - labelHeight + margin.labelTop
            })`
        );

    const binIncrement = binThresholds === 30 ? 10 : 20;

    xAxisTime.selectAll("line").attr("display", "none");
    xAxisTime.selectAll("path").attr("display", "none");
    xAxisTime.selectAll("text")
        .attr("fill", colors.MidGy)
        .style("text-anchor", "middle")
        .attr("x", 0)
        .attr("font-size", 16)
        .text((d) => 1720 + (binIncrement * d));


    // party labels - byParty only - added a background rect to add emphasis and help readability
    const partyLabelGroup = svg
        .selectAll(".partyLabelGroup")
        .data(viewType === 'byParty' ? byPartySouth.map((m) => m[0]) : [])
        .join((group) => {
            const enter = group.append("g").attr("class", "partyLabelGroup");
            enter.append("rect").attr("class", "partyLabelRect");
            enter.append("text").attr("class", "partyLabel");

            return enter;
        });

    partyLabelGroup.attr("transform", (d) => {
        const partyPos = partyPositions.find((f) => f.party === d);
        if (viewType === "byParty") {
            if (isMobile) {
                return `translate(${margin.left + timeWidth + labelHeight * 0.7},${partyPos.labelX + margin.labelTop + labelHeight}) rotate(90)`;
            }
            const yPos = southStart + fontSizeBig / 2;
            return `translate(${partyPos.labelX + margin.left + rectExtra},${yPos})`;
        }
        // only applies to byParty
        return ""
    })

    // feedback said I needed to specify Tory + Whig as well
    const labelMapper = {"Conservative": "Tory / Conservative", "Liberal": "Whig / Liberal", "Labour": "Labour"}

    partyLabelGroup.select(".partyLabel")
        .attr("font-size", fontSizeBig)
        .attr("fill", (d) => colors[d])
        .style("dominant-baseline", "middle")
        .attr("text-anchor", "middle")
        .text((d) => labelMapper[d])

    partyLabelGroup.select(".partyLabelRect")
        .attr("font-size", fontSizeBig)
        .attr("fill", (d) => colors[d])
        .attr("fill-opacity", 0.1)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("height", labelHeight)
        .attr("width", (d) => {
            const partyPos = partyPositions.find((f) => f.party === d);
            return partyPos.partyWidth;
        })
        .attr("x", (d) => {
            const partyPos = partyPositions.find((f) => f.party === d);
            return -partyPos.partyWidth / 2;
        })
        .attr("y", -labelHeight * 0.55)
        .style("dominant-baseline", "middle")
        .attr("text-anchor", "middle")
        .text((d) => d)


    // team circles - mapped to photoNames so animation works correctly
    const teamGroup = svg
        .selectAll(".teamGroup")
        .data(pmPositioned, (d) => d.photoName)
        .join((group) => {
            const enter = group.append("g").attr("class", "teamGroup");
            enter.append("circle").attr("class", "pmCircle");
            enter.append("circle").attr("class", "pmCircleBackground");
            const defs = enter.append("defs");
            defs
                .append("pattern")
                .attr("class", "nodePattern")
                .append("svg:image")
                .attr("class", "patternImage");

            return enter;
        });

    const getTransform = (d) => {
        // slightly complex transform depending on different scenarios
        const xPos = margin.left + getPos(d).x + d.extraX;
        const southExtra = southStart - dotRadius - rectExtra;
        const viewExtra = () => {
            if (viewType === 'byTime' || 'byParty') return northHeight - dotHeight - rectExtra;
            return 0;
        }
        const yPos = margin.top +
            getPos(d).y
            + (d.isSouth ? southExtra : viewExtra())
            - (viewType === 'home' && !d.isSouth ? northHeight - dotHeight - rectExtra : 0)
        if (!isTimeSmall) return `translate(${xPos},${yPos})`
        const smallXPos = width / 2 + getPos(d).x + (d.isSouth ? dotHeight : -dotHeight);
        const smallYPos = margin.labelTop + getPos(d).y + labelHeight + dotRadius + rectExtra / 2;
        return `translate(${smallXPos},${smallYPos})`;

    }
    teamGroup
        .transition()
        .duration(transitionTime)
        .attr("transform", getTransform);

    teamGroup
        .select(".nodePattern")
        .attr("id", (d, i) => `pmImage${i}`)
        .attr("width", 1)
        .attr("height", 1);

    teamGroup
        .select(".patternImage")
        .attr("xlink:href", (d) => d.photo)
        .attr("height", dotRadius * 2)
        .attr("width", dotRadius * 2);

    teamGroup
        .select(".pmCircleBackground")
        .attr("id", "chart")
        .attr("pointer-events", "none")
        .attr("r", dotRadius + 2)
        .attr("fill", "transparent")
        .attr("stroke", (d) => colors[d.data["Political Party"]])
        .style("stroke-width", 6)
        .style("stroke-opacity", 0)

    teamGroup
        .select(".pmCircle")
        .attr("r", dotRadius)
        .attr("fill", (d, i) => `url(#pmImage${i})`)
        .attr("stroke-width", 3)
        .attr("stroke", (d) => colors[d.data["Political Party"]])
        .attr("cy", viewType === 'byTime' && width < 450 ? -2 : 0) // quick fix for mobile view as Keir overlaps
        .attr("cx", (d) => viewType === 'byTime' && width < 450 ? (d.isSouth ? 3 : -3) : 0)
        .on("mousemove", (event, d) => {
            // tooltip on mousemove
            const highlight = isNorthern(d.data) ? "highlightNorth" : "highlightSouth";
            d3.select(".northLabel").attr("opacity", highlight === "highlightNorth" ? 1 : 0.2);
            d3.select(".southLabel").attr("opacity", highlight === "highlightSouth" ? 1 : 0.2);
            let tooltipText = `<span class='highlightBlack'>${d.data["Prime Minister"]}</span><br>`;
            tooltipText += `born: <span class='${highlight}'> ${d.data.Birthplace}</span><br>`
            tooltipText += `<span style="color:${colors[d.data["Political Party"]]}">${d.data["Political Party"]}</span><br>`;
            tooltipText += `from ${new Date(d.data["Term Start"]).getFullYear()} to ${new Date(d.data["Term End"]).getFullYear()}<br>`;
            if (d.data.terms > 1) {
                tooltipText += `over ${d.data.terms} terms`;
            }
            const tooltipLeft = event.pageX > (window.innerWidth - 120) ? event.pageX - 150 : event.pageX + dotRadius;
            d3.select(".chartTooltip")
                .style("left", `${tooltipLeft}px`)
                .style("top", `${event.pageY - 12}px`)
                .style("visibility", "visible")
                .html(tooltipText);
        })
        .on("mouseover", (event, d) => {
            // selection on mouseover - pulse is in css
            // using d3. rather than svg. here as selecting map circles with same class here
            d3.selectAll(".pmCircleBackground#map")
                .classed("pulse", (c) => c.photoName === d.photoName)
            d3.selectAll(".pmCircle")
                .attr("opacity", (c) => c.photoName === d.photoName ? 1 : 0.3);
        })
        .on("mouseout", () => {
            d3.select(".northLabel").attr("opacity", 1);
            d3.select(".southLabel").attr("opacity", 1)
            d3.selectAll(".pmCircleBackground").classed("pulse", false);
            d3.selectAll(".pmCircle").attr("opacity", 1);
            d3.select(".chartTooltip").style("visibility", "hidden");
        });
}
const drawMap = (div, data, width, height, redrawChart) => {

    let svg = div.select(".mapSvg");

    // non data dependent elements
    if (svg.empty()) {
        svg = div.append("svg").attr("class", "noselect mapSvg");
        svg.append("g").attr("class", "mapGroup");
        svg.append("line").attr("class", "dividerLine");
        svg.append("text").attr("class", "scotland1");
        svg.append("text").attr("class", "scotland2");
        svg.append("text").attr("class", "scotland3");
        svg.append("text").attr("class", "scotlandY fa");  // you need cdn for FA icons to work + this class
        svg.append("text").attr("class", "scotlandN fa");
    }

    const mapGroup = svg.select(".mapGroup");

    svg.attr("width", `${width}px`)
        .attr("height", `${height}px`);

    // key variables
    const {primeMinisters, ukIrelandAll} = data;
    const padding = 10;
    const mapHeight = height - (padding * 2);
    const mapWidth = 5 * (mapHeight / 6);
    const sideMargin = (width - mapWidth) / 2;
    const circleRadius = 2;
    let furtherX = 10 + circleRadius;

    // projection + path
    const projection = d3
        .geoMercator()
        .fitSize([mapWidth, mapHeight], ukIrelandAll);

    const path = d3.geoPath(projection);

    // use projection to add location centroids
    // F === foreign - aligned top left
    const pmData = primeMinisters.reduce((acc, entry) => {
        if (entry.Location !== "F") {
            entry.centroid = projection([
                entry["Birth Longitude"],
                entry["Birth Latitude"]
            ]);
        } else {
            entry.centroid = [furtherX, 10 + circleRadius];
            furtherX += circleRadius * 3;
        }
        acc.push(entry);
        return acc;
    }, []);

    // quick add on for clarity - argument about this issue
    svg.select(".scotland1")
        .attr("pointer-events", "none")
        .attr("text-anchor", "end")
        .attr("fill", colors.MidGy)
        .attr("font-size", 14)
        .attr("x", width - padding)
        .attr("y", padding + 10)
        .text("Is Scotland")

    svg.select(".scotland2")
        .attr("pointer-events", "none")
        .attr("text-anchor", "end")
        .attr("fill", colors.N)
        .attr("font-size", 14)
        .attr("x", width - padding - 9)
        .attr("y", padding + 26)
        .text("Northern")

    svg.select(".scotland3")
        .attr("pointer-events", "none")
        .attr("text-anchor", "end")
        .attr("fill", colors.MidGy)
        .attr("font-size", 14)
        .attr("x", width - padding)
        .attr("y", padding + 26)
        .text("?")

    const toggleScotland = () => {
        if (window.includeScotland) {
            d3.select(".scotlandY")
                .attr("fill", colors.Gy);

            d3.select(".scotland2")
                .attr("fill", colors.MidGy);

            d3.select(".scotlandN")
                .attr("fill", colors.I);
            window.includeScotland = false
        } else {
            d3.select(".scotland2")
                .attr("fill", colors.N)
            d3.select(".scotlandY")
                .attr("fill", colors.N);

            d3.select(".scotlandN")
                .attr("fill", colors.Gy);
            window.includeScotland = true
        }
        svg.selectAll(".pmCircle")
            .attr("fill", getMapDotColor);
        svg.selectAll(".pmCircleBackground")
            .attr("stroke", getMapDotColor)
        redrawChart();
    }

    const getMapDotColor = (d) => {
        if (d.Location === "NS") {
            return isNorthern(d) ? colors.N : colors.I;
        }
        return colors[d.Location]
    }

    svg.select(".scotlandY")
        .attr("cursor", "pointer")
        .attr("text-anchor", "end")
        .attr("fill", colors.N)
        .attr("font-size", 14)
        .attr("x", width - padding - 24)
        .attr("y", padding + 47)
        .text("\uf058")
        .on("click", toggleScotland);

    svg.select(".scotlandN")
        .attr("cursor", "pointer")
        .attr("text-anchor", "end")
        .attr("fill", colors.Gy)
        .attr("font-size", 14)
        .attr("x", width - padding - 7)
        .attr("y", padding + 47)
        .text("\uf057")
        .on("click", toggleScotland);


    // geojson features
    const continentGroup = mapGroup
        .selectAll(".continentGroup")
        .data(ukIrelandAll.features)
        .join((group) => {
            const enter = group.append("g").attr("class", "continentGroup");
            enter.append("path").attr("class", "continentPath");
            return enter;
        });

    continentGroup.attr("transform", `translate(${sideMargin},${padding})`)

    continentGroup
        .select(".continentPath")
        .attr("d", path)
        .style("stroke-linejoin", "round")
        .style("stroke-linecap", "round")
        .attr("fill", colors.Gy);

    // team circles
    const teamGroup = mapGroup
        .selectAll(".teamGroup")
        .data(pmData)
        .join((group) => {
            const enter = group.append("g").attr("class", "teamGroup");
            enter.append("circle").attr("class", "pmCircle");
            enter.append("circle").attr("class", "pmCircleBackground");

            const defs = enter.append("defs");
            defs
                .append("pattern")
                .attr("class", "nodePattern")
                .append("svg:image")
                .attr("class", "patternImage");

            return enter;
        });

    teamGroup
        .select(".nodePattern")
        .attr("id", (d) => `countryImage${d.code}`)
        .attr("width", 1)
        .attr("height", 1);

    teamGroup
        .select(".patternImage")
        .attr(
            "xlink:href",
            (d) => `https://hatscripts.github.io/circle-flags/flags/${d.flagCode}.svg`
        )
        .attr("height", circleRadius * 2)
        .attr("width", circleRadius * 2);

    teamGroup
        .select(".pmCircleBackground")
        .attr("id", "map")
        .attr("pointer-events", "none")
        .attr("r", circleRadius)
        .attr("fill", "transparent")
        .attr("stroke", getMapDotColor)
        .style("stroke-width", 4)
        .style("stroke-opacity", 0)

    teamGroup
        .select(".pmCircle")
        .attr("r", circleRadius)
        .attr("fill", getMapDotColor)
        .style("stroke-width", 0)
        .on("mouseover", (event, d) => {
            // no mousemove separation here as circles so small
            d3.selectAll(".pmCircleBackground#chart")
                .classed("pulse", (c) => c.photoName === d.photoName);
            d3.selectAll(".pmCircle")
                .attr("opacity", (c) => c.photoName === d.photoName ? 1 : 0.3);
            const highlight = isNorthern(d.Location) ? "highlightNorth" : "highlightSouth";
            d3.select(".northLabel").attr("opacity", highlight === "highlightNorth" ? 1 : 0.2);
            d3.select(".southLabel").attr("opacity", highlight === "highlightSouth" ? 1 : 0.2);
            d3.select(".chartTooltip")
                .style("left", `${event.pageX - 130}px`)
                .style("top", `${event.pageY}px`)
                .style("visibility", "visible")
                .html(`<span class='highlightBlack'>${d["Prime Minister"]}</span> born in <span class='${highlight}'> ${d.Birthplace}</span>`);

        })
        .on("mouseout", () => {
            d3.select(".northLabel").attr("opacity", 1);
            d3.select(".southLabel").attr("opacity", 1);
            d3.selectAll(".pmCircle").attr("opacity", 1);
            d3.selectAll(".pmCircleBackground").classed("pulse", false);
            d3.select(".chartTooltip").style("visibility", "hidden");
        });

    // ChatGPT estimate of Severn–Wash divide
    const divide = [
        [-3.2, 52.35],
        [1.3, 53.1]
    ]
    const divide1Centroid = projection(divide[0]);
    const divide2Centroid = projection(divide[1]);

    svg
        .select(".dividerLine")
        .attr("x1", divide1Centroid[0] + sideMargin)
        .attr("x2", divide2Centroid[0] + sideMargin)
        .attr("y1", divide1Centroid[1] + padding)
        .attr("y2", divide2Centroid[1] + padding)
        .attr("stroke-width", 1)
        .attr("stroke", "#484848");

    // simulation to add a beeswarm element to the location circles as there was a bit of overlap
    const simulation = d3
        .forceSimulation()
        .alphaDecay(0.1)
        .force("x", d3.forceX((d) => d.centroid[0]).strength(0.4))
        .force("y", d3.forceY((d) => d.centroid[1]).strength(0.4))
        .force(
            "collide",
            d3
                .forceCollide()
                .radius(circleRadius * 1.05)
                .strength(1)
        );
    simulation.stop();
    simulation.nodes(pmData);
    simulation.tick(300); // instead of running simulation on tick, skip to tick 300 so no jittering

    // transform group
    teamGroup.attr("transform", (d) => `translate(${d.x + sideMargin},${d.y + padding})`);


}

